// ============================================================================
// Competitive circuit: season calendar, tournament formats (Swiss 3-3,
// single elimination, round-robin groups), qualification, points and prizes.
// ============================================================================
import type { GameState, Match, Region, Stage, Standing, Tournament, TournamentKind } from './types';
import { REGIONS } from './types';
import { REGION_INFO } from './data';
import { addDays, newId, money } from './util';
import { simulateSeries, aggregateSeries } from './results';
import { book } from './ledger';
import { addNews, inbox } from './news';
import { orgPlayers, starters } from './roster';
import { checkPlacementObjectives } from './commercial';

export const REGIONAL_DATES = [['01-15', '02-05', '02-26'], ['05-07', '05-28', '06-18']];
export const MAJOR_DATES = ['03-26', '07-16'];
export const WORLDS_DATE = '09-10';
export const INVITATIONAL_DATE = '11-12';
export const MAJOR_NAMES = ['Major de Printemps', 'Major d\'Été'];
export const MAJOR_CITIES = [['Copenhague', 'Dallas', 'Riyad', 'Paris', 'Sydney', 'Rio'], ['Londres', 'Boston', 'Lisbonne', 'Tokyo', 'Le Cap', 'Montréal']];

const REG_POINTS: Record<string, number> = { '1': 100, '2': 75, '3-4': 55, '5-8': 35, '9-11': 20, '12-14': 12, '15-16': 6 };
const MAJOR_POINTS: Record<string, number> = { '1': 300, '2': 240, '3-4': 180, '5-8': 120, '9-11': 60, '12-14': 35, '15-16': 20 };
const PRIZE_SPLIT: Record<string, number> = { '1': 0.33, '2': 0.18, '3-4': 0.095, '5-8': 0.045, '9-11': 0.0125, '12-14': 0.009, '15-16': 0.006, '5-6': 0.07, '7-8': 0.04 };

export function createSeasonCalendar(g: GameState, season: number) {
  const mk = (p: Partial<Tournament> & { name: string; short: string; kind: TournamentKind; region: Region | 'INTL'; start: string; prizePool: number; lan: boolean; split: number }): Tournament => {
    const t: Tournament = {
      id: newId(g, 't'), season, teamIds: [], stages: [], stageIdx: 0, status: 'upcoming', placements: [],
      end: addDays(p.start, p.kind === 'regional' ? 5 : p.kind === 'invitational' ? 4 : 6),
      registrationDeadline: addDays(p.start, -3), ...p,
    } as Tournament;
    g.tournaments[t.id] = t;
    return t;
  };
  for (let split = 1; split <= 2; split++) {
    REGIONAL_DATES[split - 1].forEach((d, i) => {
      for (const r of REGIONS) {
        const n = (split - 1) * 3 + i + 1;
        mk({ name: `RLCS ${season} ${REGION_INFO[r].name} — Régional ${n}`, short: `${r} Régional ${n}`, kind: 'regional', region: r, start: `${season}-${d}`, prizePool: Math.round(100000 * REGION_INFO[r].prizeMult), lan: false, split });
      }
    });
    const city = MAJOR_CITIES[split - 1][(season + split) % 6];
    mk({ name: `RLCS ${season} ${MAJOR_NAMES[split - 1]} — ${city}`, short: `Major ${split} (${city})`, kind: 'major', region: 'INTL', start: `${season}-${MAJOR_DATES[split - 1]}`, prizePool: 350000, lan: true, split });
  }
  mk({ name: `RLCS ${season} World Championship — ${['Fort Worth', 'Düsseldorf', 'Lyon', 'Toronto', 'Riyad'][season % 5]}`, short: 'Worlds', kind: 'worlds', region: 'INTL', start: `${season}-${WORLDS_DATE}`, prizePool: 1000000, lan: true, split: 0 });
  mk({ name: `Winter Clash Invitational ${season}`, short: 'Winter Clash', kind: 'invitational', region: 'INTL', start: `${season}-${INVITATIONAL_DATE}`, prizePool: 150000, lan: true, split: 0 });
}

// ---------------------------------------------------------------- helpers
export const activeOrgs = (g: GameState, region?: Region) => Object.values(g.orgs).filter(o => !o.disbanded && (!region || o.region === region));
function mkStanding(id: string, group?: number): Standing { return { teamId: id, w: 0, l: 0, gw: 0, gl: 0, eliminated: false, qualified: false, group }; }
function addMatch(g: GameState, t: Tournament, stageIdx: number, round: number, label: string, date: string, a: string, b: string, bestOf: number) {
  const m: Match = { id: newId(g, 'm'), tournamentId: t.id, stageIdx, round, label, date, teamA: a, teamB: b, bestOf, games: [], winner: null, played: false };
  g.matches[m.id] = m;
  t.stages[stageIdx].matchIds.push(m.id);
  return m;
}
export const tMatches = (g: GameState, t: Tournament) => t.stages.flatMap(s => s.matchIds.map(id => g.matches[id]));

// ---------------------------------------------------------------- seeding
function seedTeams(g: GameState, t: Tournament): string[] {
  if (t.kind === 'regional') {
    const sp = g.splitPoints[`${t.season}-${t.split}`] ?? {};
    return activeOrgs(g, t.region as Region).sort((a, b) => (sp[b.id] ?? 0) - (sp[a.id] ?? 0) || b.elo - a.elo).slice(0, 16).map(o => o.id);
  }
  const picks: string[] = [];
  const pts = t.kind === 'major' ? (g.splitPoints[`${t.season}-${t.split}`] ?? {}) : (g.circuitPoints[t.season] ?? {});
  if (t.kind === 'invitational') {
    return activeOrgs(g).sort((a, b) => b.elo - a.elo).slice(0, 8).map(o => o.id);
  }
  for (const r of REGIONS) {
    const list = activeOrgs(g, r).sort((a, b) => (pts[b.id] ?? 0) - (pts[a.id] ?? 0) || b.elo - a.elo);
    picks.push(...list.slice(0, REGION_INFO[r].majorSlots).map(o => o.id));
  }
  // seed by points then elo
  return picks.sort((a, b) => (pts[b] ?? 0) - (pts[a] ?? 0) || g.orgs[b].elo - g.orgs[a].elo);
}

export function startTournament(g: GameState, t: Tournament) {
  t.teamIds = seedTeams(g, t);
  t.status = 'live';
  if (t.kind === 'invitational') {
    t.stages = [
      { name: 'Phase de groupes', format: 'groups', bestOf: 5, teamIds: t.teamIds.slice(), standings: [], round: 0, matchIds: [], done: false, advance: 4 },
      { name: 'Playoffs', format: 'single', bestOf: 7, teamIds: [], standings: [], round: 0, matchIds: [], done: false, advance: 1 },
    ];
    const st = t.stages[0];
    // snake into 2 groups
    t.teamIds.forEach((id, i) => st.standings.push(mkStanding(id, [0, 1, 1, 0][i % 4])));
    for (let gi = 0; gi < 2; gi++) {
      const ids = st.standings.filter(s => s.group === gi).map(s => s.teamId);
      const rr = [[0, 3, 1, 2], [0, 2, 3, 1], [0, 1, 2, 3]];
      rr.forEach((pair, r) => {
        addMatch(g, t, 0, r, `Groupe ${'AB'[gi]} — J${r + 1}`, addDays(t.start, r), ids[pair[0]], ids[pair[1]], 5);
        addMatch(g, t, 0, r, `Groupe ${'AB'[gi]} — J${r + 1}`, addDays(t.start, r), ids[pair[2]], ids[pair[3]], 5);
      });
    }
  } else {
    t.stages = [
      { name: 'Phase suisse', format: 'swiss', bestOf: 5, teamIds: t.teamIds.slice(), standings: t.teamIds.map(id => mkStanding(id)), round: 0, matchIds: [], done: false, advance: 8 },
      { name: 'Playoffs', format: 'single', bestOf: 7, teamIds: [], standings: [], round: 0, matchIds: [], done: false, advance: 1 },
    ];
    swissRound(g, t);
  }
  for (const id of t.teamIds) {
    const o = g.orgs[id];
    if (o.isUser) inbox(g, `${t.short} commence`, `Votre équipe est engagée dans ${t.name}. Cashprize total : ${money(t.prizePool)}.`, { kind: 'screen', id: `tournament:${t.id}` });
    if (t.lan) {
      // travel & accommodation (LAN)
      const cost = Math.round((o.region === 'EU' || o.region === 'NA' ? 9000 : 14000) * (1 + o.facilities * 0.05));
      book(g, o.id, 'Voyages', -cost, `Déplacement — ${t.short}`);
      for (const p of starters(g, o.id)) p.cond.fatigue = Math.min(100, p.cond.fatigue + (o.region === 'EU' ? 3 : 7));
    }
  }
  if (t.kind !== 'regional') addNews(g, { kind: 'world', title: `${t.name} : les ${t.teamIds.length} équipes sont connues`, body: `Têtes de série : ${t.teamIds.slice(0, 4).map(id => g.orgs[id].name).join(', ')}.`, orgIds: t.teamIds, playerIds: [], important: t.teamIds.includes(g.userOrgId ?? '') });
}

const SWISS_DAY = [0, 0, 1, 1, 2];
function swissRound(g: GameState, t: Tournament) {
  const st = t.stages[0];
  const r = st.round;
  const active = st.standings.filter(s => !s.qualified && !s.eliminated);
  const seedIdx = (id: string) => st.teamIds.indexOf(id);
  const played = new Set(st.matchIds.map(id => { const m = g.matches[id]; return [m.teamA, m.teamB].sort().join('|'); }));
  const groups = new Map<string, Standing[]>();
  for (const s of active) { const k = `${s.w}-${s.l}`; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(s); }
  for (const [k, list] of groups) {
    list.sort((a, b) => (b.gw - b.gl) - (a.gw - a.gl) || seedIdx(a.teamId) - seedIdx(b.teamId));
    const pool = list.map(s => s.teamId);
    while (pool.length >= 2) {
      const a = pool.shift()!;
      let j = pool.length - 1;
      while (j > 0 && played.has([a, pool[j]].sort().join('|'))) j--;
      const b = pool.splice(j, 1)[0];
      addMatch(g, t, 0, r, `Suisse R${r + 1} (${k})`, addDays(t.start, SWISS_DAY[r] ?? 2), a, b, 5);
    }
  }
}

function playoffRoundLabel(n: number) { return n === 8 ? 'Quart de finale' : n === 4 ? 'Demi-finale' : n === 2 ? 'Grande finale' : `Tour de ${n}`; }

function startPlayoffs(g: GameState, t: Tournament, seeds: string[]) {
  const st = t.stages[1];
  st.teamIds = seeds;
  st.standings = seeds.map(id => mkStanding(id));
  const order = seeds.length === 8 ? [[0, 7], [3, 4], [1, 6], [2, 5]] : [[0, 3], [1, 2]];
  const day = t.kind === 'invitational' ? 3 : t.kind === 'regional' ? 3 : 4;
  for (const [a, b] of order) addMatch(g, t, 1, 0, playoffRoundLabel(seeds.length), addDays(t.start, day), seeds[a], seeds[b], st.bestOf);
}

/** Called after matches are played; generates next rounds or finalises. */
export function progressTournament(g: GameState, t: Tournament) {
  if (t.status !== 'live') return;
  const st = t.stages[t.stageIdx];
  const ms = st.matchIds.map(id => g.matches[id]);
  if (ms.some(m => !m.played)) return;
  // update standings
  for (const s of st.standings) { s.w = 0; s.l = 0; s.gw = 0; s.gl = 0; }
  for (const m of ms) {
    const sa = st.standings.find(s => s.teamId === m.teamA), sb = st.standings.find(s => s.teamId === m.teamB);
    if (!sa || !sb) continue;
    const wa = m.games.filter(x => x.scoreA > x.scoreB).length, wb = m.games.length - wa;
    sa.gw += wa; sa.gl += wb; sb.gw += wb; sb.gl += wa;
    if (m.winner === m.teamA) { sa.w++; sb.l++; } else { sb.w++; sa.l++; }
  }
  if (st.format === 'swiss') {
    for (const s of st.standings) { if (s.w >= 3) s.qualified = true; if (s.l >= 3) s.eliminated = true; }
    st.round++;
    if (st.standings.some(s => !s.qualified && !s.eliminated)) { swissRound(g, t); return; }
    st.done = true;
    const q = st.standings.filter(s => s.qualified).sort((a, b) => a.l - b.l || (b.gw - b.gl) - (a.gw - a.gl) || st.teamIds.indexOf(a.teamId) - st.teamIds.indexOf(b.teamId));
    t.stageIdx = 1;
    startPlayoffs(g, t, q.map(s => s.teamId));
    return;
  }
  if (st.format === 'groups') {
    st.done = true;
    const groupRank = (gi: number) => st.standings.filter(s => s.group === gi).sort((a, b) => b.w - a.w || (b.gw - b.gl) - (a.gw - a.gl));
    const A = groupRank(0), B = groupRank(1);
    for (const s of [...A.slice(2), ...B.slice(2)]) s.eliminated = true;
    t.stageIdx = 1;
    // seeds A1, B1, A2, B2 with pairs [0,3],[1,2] => A1-B2 and B1-A2
    startPlayoffs(g, t, [A[0].teamId, B[0].teamId, A[1].teamId, B[1].teamId]);
    return;
  }
  // single elimination
  const roundMs = ms.filter(m => m.round === st.round);
  const winners = roundMs.map(m => m.winner!);
  for (const m of roundMs) { const loser = m.winner === m.teamA ? m.teamB : m.teamA; const s = st.standings.find(x => x.teamId === loser); if (s) s.eliminated = true; }
  if (winners.length === 1) { st.done = true; finishTournament(g, t); return; }
  st.round++;
  const date = addDays(roundMs[0].date, st.round === 1 && winners.length === 4 ? 1 : 0);
  for (let i = 0; i < winners.length; i += 2) addMatch(g, t, t.stageIdx, st.round, playoffRoundLabel(winners.length), date, winners[i], winners[i + 1], st.bestOf);
}

// ---------------------------------------------------------------- final placements, prize money, points
function finishTournament(g: GameState, t: Tournament) {
  t.status = 'done';
  const po = t.stages[t.stageIdx];
  const pms = po.matchIds.map(id => g.matches[id]);
  const final = pms[pms.length - 1];
  const placements: { teamId: string; place: string; rank: number }[] = [];
  placements.push({ teamId: final.winner!, place: '1', rank: 1 });
  placements.push({ teamId: final.winner === final.teamA ? final.teamB : final.teamA, place: '2', rank: 2 });
  const losersOf = (round: number) => pms.filter(m => m.round === round).map(m => (m.winner === m.teamA ? m.teamB : m.teamA));
  const maxRound = final.round;
  if (maxRound >= 1) losersOf(maxRound - 1).forEach(id => placements.push({ teamId: id, place: '3-4', rank: 3 }));
  if (maxRound >= 2) losersOf(maxRound - 2).forEach(id => placements.push({ teamId: id, place: '5-8', rank: 5 }));
  const first = t.stages[0];
  if (first.format === 'swiss') {
    const elim = first.standings.filter(s => s.eliminated).sort((a, b) => b.w - a.w || (b.gw - b.gl) - (a.gw - a.gl));
    for (const s of elim) placements.push({ teamId: s.teamId, place: s.w === 2 ? '9-11' : s.w === 1 ? '12-14' : '15-16', rank: s.w === 2 ? 9 : s.w === 1 ? 12 : 15 });
  } else {
    const elim = first.standings.filter(s => s.eliminated).sort((a, b) => b.w - a.w);
    elim.forEach(s => placements.push({ teamId: s.teamId, place: s.w >= 1 ? '5-6' : '7-8', rank: s.w >= 1 ? 5 : 7 }));
  }
  const ptsTable = t.kind === 'regional' ? REG_POINTS : t.kind === 'major' ? MAJOR_POINTS : null;
  t.placements = placements.map(p => ({ ...p, prize: Math.round(t.prizePool * (PRIZE_SPLIT[p.place] ?? 0)), points: ptsTable?.[p.place] ?? 0 }));

  // MVP of the event (best avg rating among top 4)
  const top4 = new Set(t.placements.filter(p => p.rank <= 3).map(p => p.teamId));
  const agg = new Map<string, { r: number; n: number }>();
  for (const m of tMatches(g, t)) {
    for (const [pid, s] of aggregateSeries(m)) {
      const team = s.side === 'A' ? m.teamA : m.teamB;
      if (!top4.has(team)) continue;
      const cur = agg.get(pid) ?? { r: 0, n: 0 }; cur.r += s.rating * s.games; cur.n += s.games; agg.set(pid, cur);
    }
  }
  const mvp = [...agg.entries()].filter(([, v]) => v.n >= 6).sort((a, b) => b[1].r / b[1].n - a[1].r / a[1].n)[0];
  if (mvp) { t.mvpId = mvp[0]; const p = g.players[mvp[0]]; if (p) { p.achievements.push(`MVP — ${t.name}`); p.reputation = Math.min(99, p.reputation + 3); p.popularity = Math.min(99, p.popularity + 3); } }

  for (const pl of t.placements) {
    const org = g.orgs[pl.teamId];
    if (!org) continue;
    if (org.isUser && t.kind !== 'invitational') checkPlacementObjectives(g, org.id, pl.rank);
    // points
    if (pl.points) {
      g.circuitPoints[t.season] ??= {};
      g.circuitPoints[t.season][org.id] = (g.circuitPoints[t.season][org.id] ?? 0) + pl.points;
      if (t.split) { const k = `${t.season}-${t.split}`; g.splitPoints[k] ??= {}; g.splitPoints[k][org.id] = (g.splitPoints[k][org.id] ?? 0) + pl.points; }
    }
    // prize money split between org and players per contract
    const roster = starters(g, org.id);
    if (pl.prize > 0) {
      const share = roster.length ? roster.reduce((a, p) => a + (p.contract?.prizeShare ?? 0.8), 0) / roster.length : 0;
      const orgCut = Math.round(pl.prize * (1 - share));
      book(g, org.id, 'Prize money', orgCut, `${t.short} — ${pl.place === '1' ? 'Vainqueur' : pl.place + 'e'} (part org. ${Math.round((1 - share) * 100)}%)`);
      const per = (pl.prize - orgCut) / Math.max(1, roster.length);
      for (const p of roster) p.careerEarnings += per;
      if (!g.records.biggestPrize || pl.prize > g.records.biggestPrize.value) g.records.biggestPrize = { value: pl.prize, label: `${org.name} — ${t.name}`, date: g.date };
    }
    if (pl.rank === 1) {
      org.trophies.push({ season: t.season, tournament: t.name, tier: t.kind });
      const bonus = roster.reduce((a, p) => a + (p.contract?.winBonus ?? 0), 0);
      if (bonus) book(g, org.id, 'Primes', -bonus, `Primes de victoire — ${t.short}`);
      for (const p of orgPlayers(g, org.id)) if (p.squadRole === 'starter') { p.achievements.push(`Champion — ${t.name}`); p.cond.morale = Math.min(100, p.cond.morale + 12); }
      org.reputation = Math.min(99, org.reputation + (t.kind === 'regional' ? 1 : t.kind === 'major' ? 3 : t.kind === 'worlds' ? 5 : 1));
      org.fans = Math.round(org.fans * (t.kind === 'regional' ? 1.02 : t.kind === 'major' ? 1.06 : t.kind === 'worlds' ? 1.12 : 1.03));
      const s = org.social; const boost = t.kind === 'worlds' ? 0.2 : t.kind === 'major' ? 0.1 : 0.03;
      s.x *= 1 + boost; s.tiktok *= 1 + boost * 1.3; s.youtube *= 1 + boost; s.twitch *= 1 + boost; s.discord *= 1 + boost * 0.8;
      s.sentiment = Math.min(100, s.sentiment + 10);
      if (org.isUser) g.manager.trophies.push(`${t.name}`);
    }
  }
  const w = g.orgs[final.winner!], ru = g.orgs[final.winner === final.teamA ? final.teamB : final.teamA];
  const fs = final.games.filter(x => x.scoreA > x.scoreB).length, fb = final.games.length - fs;
  addNews(g, {
    kind: 'result', important: t.kind !== 'regional' || w.isUser || ru.isUser,
    title: `${w.name} remporte ${t.short} !`,
    body: `${w.name} s'impose ${Math.max(fs, fb)}-${Math.min(fs, fb)} en grande finale face à ${ru.name} et empoche ${money(t.placements[0].prize)}.${t.mvpId ? ` MVP : ${g.players[t.mvpId]?.tag}.` : ''}`,
    orgIds: [w.id, ru.id], playerIds: t.mvpId ? [t.mvpId] : [],
  });
  const u = g.userOrgId ? t.placements.find(p => p.teamId === g.userOrgId) : undefined;
  if (u) inbox(g, `${t.short} terminé — ${u.place === '1' ? 'VICTOIRE !' : 'place ' + u.place}`, `Gains : ${money(u.prize)} (avant partage joueurs) · Points circuit : ${u.points}.`, { kind: 'screen', id: `tournament:${t.id}` });
}


// ---------------------------------------------------------------- daily driver
export function startTournamentsToday(g: GameState) {
  for (const t of Object.values(g.tournaments)) if (t.status === 'upcoming' && t.start <= g.date && t.season === g.season) startTournament(g, t);
}

export function todaysMatches(g: GameState) {
  const out: Match[] = [];
  for (const t of Object.values(g.tournaments)) if (t.status === 'live') for (const m of tMatches(g, t)) if (!m.played && m.date <= g.date) out.push(m);
  return out;
}

/** Plays all AI matches due today; returns the user's pending match if any. */
export function playDay(g: GameState): Match | null {
  for (let guard = 0; guard < 30; guard++) {
    const due = todaysMatches(g);
    const user = due.find(m => g.orgs[m.teamA].isUser || g.orgs[m.teamB].isUser);
    const ai = due.filter(m => m !== user);
    if (!ai.length) return user ?? null;
    for (const m of ai) simulateSeries(g, m);
    for (const t of Object.values(g.tournaments)) if (t.status === 'live') progressTournament(g, t);
  }
  return null;
}

export function userNextMatch(g: GameState): Match | null {
  if (!g.userOrgId) return null;
  const ms = Object.values(g.matches).filter(m => !m.played && (m.teamA === g.userOrgId || m.teamB === g.userOrgId)).sort((a, b) => a.date.localeCompare(b.date));
  return ms[0] ?? null;
}
export function nextUserTournament(g: GameState): Tournament | null {
  const uid = g.userOrgId; if (!uid) return null;
  const org = g.orgs[uid];
  return Object.values(g.tournaments).filter(t => t.status !== 'done' && (t.status === 'live' ? t.teamIds.includes(uid) : (t.region === org.region || t.region === 'INTL'))).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
}
