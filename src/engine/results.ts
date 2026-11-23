import type { GameResult, GameState, Match, Player, PlayerGameStats, Tactic } from './types';
import { GameSim, betweenGames, buildSide, type SideCtx } from './matchsim';
import { lineup } from './roster';
import { growChemistry } from './chemistry';
import { addNews } from './news';
import { clamp, rand } from './util';
import { marketValue } from './player';

export function matchImportance(g: GameState, m: Match): number {
  const t = g.tournaments[m.tournamentId];
  let imp = t.kind === 'regional' ? 0.25 : t.kind === 'major' ? 0.55 : t.kind === 'worlds' ? 0.7 : 0.3;
  const st = t.stages[m.stageIdx];
  if (st.format === 'single') imp += 0.15 + (m.label.includes('Finale') && !m.label.includes('Demi') && !m.label.includes('Quart') ? 0.15 : 0);
  return clamp(imp, 0, 1);
}

export function prepareSides(g: GameState, m: Match, tacticA?: Tactic, tacticB?: Tactic): [SideCtx, SideCtx, number] {
  const imp = matchImportance(g, m);
  const oA = g.orgs[m.teamA], oB = g.orgs[m.teamB];
  const lA = lineup(g, oA), lB = lineup(g, oB);
  return [buildSide(g, oA, lA, imp, tacticA), buildSide(g, oB, lB, imp, tacticB), imp];
}

/** Instantly simulate a full series (AI matches or "quick sim"). */
export function simulateSeries(g: GameState, m: Match) {
  const [A, B, imp] = prepareSides(g, m);
  playRemainingGames(g, m, A, B, imp);
  applySeriesResult(g, m);
}

export function seriesNeeded(m: Match) { return Math.ceil(m.bestOf / 2); }
export function seriesScore(m: Match): [number, number] {
  let a = 0, b = 0;
  for (const gr of m.games) { if (gr.scoreA > gr.scoreB) a++; else b++; }
  return [a, b];
}

export function playRemainingGames(g: GameState, m: Match, A: SideCtx, B: SideCtx, imp: number) {
  const need = seriesNeeded(m);
  let [wa, wb] = seriesScore(m);
  while (wa < need && wb < need) {
    const sp = (wa === need - 1 || wb === need - 1) ? 0.5 : 0;
    const sim = new GameSim(A, B, imp, sp);
    sim.runToEnd();
    const r = sim.result(false);
    m.games.push(r);
    if (r.scoreA > r.scoreB) { wa++; betweenGames(B, true, imp); betweenGames(A, false, imp); }
    else { wb++; betweenGames(A, true, imp); betweenGames(B, false, imp); }
  }
  m.rosterA = A.players.map(x => x.p.id); m.rosterB = B.players.map(x => x.p.id);
}

function applyPlayerGame(p: Player, s: PlayerGameStats, won: boolean) {
  for (const line of [p.season, p.career]) {
    line.games++; if (won) line.wins++;
    line.goals += s.goals; line.assists += s.assists; line.saves += s.saves; line.shots += s.shots; line.demos += s.demos;
    line.ratingSum += s.rating; line.score += s.score;
  }
  p.recentRatings.push(s.rating);
  if (p.recentRatings.length > 15) p.recentRatings.shift();
}

/** Consequences of a series: stats, form, morale, fatigue, chemistry, Elo, reputation, news. */
export function applySeriesResult(g: GameState, m: Match) {
  const [wa, wb] = seriesScore(m);
  m.played = true;
  m.winner = wa > wb ? m.teamA : m.teamB;
  const imp = matchImportance(g, m);
  const oA = g.orgs[m.teamA], oB = g.orgs[m.teamB];
  const ids = { A: m.rosterA ?? [], B: m.rosterB ?? [] };

  // per-game stats & MVP
  for (const gr of m.games) {
    const winA = gr.scoreA > gr.scoreB;
    for (const s of gr.statsA) { const p = g.players[s.pid]; if (p) applyPlayerGame(p, s, winA); }
    for (const s of gr.statsB) { const p = g.players[s.pid]; if (p) applyPlayerGame(p, s, !winA); }
  }
  const allStats = aggregateSeries(m);
  const winnerSide = m.winner === m.teamA ? 'A' : 'B';
  const mvp = [...allStats.values()].filter(x => x.side === winnerSide).sort((a, b) => b.rating - a.rating)[0];
  if (mvp && g.players[mvp.pid]) { g.players[mvp.pid].season.mvps++; g.players[mvp.pid].career.mvps++; }

  // condition & morale
  for (const [side, org, won] of [['A', oA, m.winner === m.teamA], ['B', oB, m.winner === m.teamB]] as const) {
    for (const pid of ids[side]) {
      const p = g.players[pid]; if (!p || p.orgId !== org.id) continue;
      const st = allStats.get(pid);
      const r = st ? st.rating : 6;
      p.cond.form = clamp(p.cond.form * 0.75 + (50 + (r - 6.5) * 14) * 0.25, 5, 95);
      p.cond.morale = clamp(p.cond.morale + (won ? 3 + imp * 6 : -(2 + imp * 7)) * (p.attrs.confidence > 70 ? 0.8 : 1), 5, 98);
      p.cond.fatigue = clamp(p.cond.fatigue + m.games.length * 1.6 * (1.2 - p.attrs.professionalism / 200), 0, 100);
      p.popularity = clamp(p.popularity + (won ? 0.15 : -0.05) * (1 + imp * 3) + (r - 6.5) * 0.08, 1, 99);
      p.reputation = clamp(p.reputation + (r - 6.4) * 0.08 * (1 + imp * 2) + (won ? 0.05 : -0.03), 1, 99);
    }
    growChemistry(g, org, ids[side].filter(id => g.players[id]?.orgId === org.id), (won ? 1.6 : 0.9) * (0.8 + m.games.length * 0.08));
  }

  // Elo (team world ranking)
  const ea = oA.elo, eb = oB.elo;
  const exp = 1 / (1 + Math.pow(10, (eb - ea) / 400));
  const margin = Math.abs(wa - wb) / seriesNeeded(m);
  const K = 22 * (1 + imp) * (0.8 + margin * 0.4);
  const sA = m.winner === m.teamA ? 1 : 0;
  oA.elo = Math.round(ea + K * (sA - exp));
  oB.elo = Math.round(eb + K * ((1 - sA) - (1 - exp)));
  const winOrg = g.orgs[m.winner!], loseOrg = m.winner === m.teamA ? oB : oA;
  winOrg.reputation = clamp(winOrg.reputation + 0.03 * (1 + imp * 2), 1, 99);
  loseOrg.reputation = clamp(loseOrg.reputation - 0.02 * (1 + imp), 1, 99);
  const fansDelta = (o: typeof oA, w: boolean) => { o.fans = Math.max(100, Math.round(o.fans * (1 + (w ? 0.004 : -0.0015) * (1 + imp * 3)))); };
  fansDelta(winOrg, true); fansDelta(loseOrg, false);

  // upset detection -> news
  const winnerElo = m.winner === m.teamA ? ea : eb, loserElo = m.winner === m.teamA ? eb : ea;
  const t = g.tournaments[m.tournamentId];
  if (loserElo - winnerElo > 140 && rand() < 0.8) {
    addNews(g, { kind: 'result', title: `Surprise : ${winOrg.name} fait tomber ${loseOrg.name}`, body: `${winOrg.tag} s'impose ${Math.max(wa, wb)}-${Math.min(wa, wb)} face à ${loseOrg.name} (${t.short}, ${m.label}). Un résultat que peu d'observateurs avaient vu venir.`, orgIds: [winOrg.id, loseOrg.id], playerIds: [], important: oA.isUser || oB.isUser });
  }
  // records
  const goals = new Map<string, number>();
  for (const [pid, st] of allStats) goals.set(pid, st.goals);
  for (const [pid, gl] of goals) {
    if (!g.records.seriesGoals || gl > g.records.seriesGoals.value) {
      const p = g.players[pid];
      if (p) g.records.seriesGoals = { value: gl, label: `${p.tag} — ${oA.tag} vs ${oB.tag} (${t.short})`, date: g.date };
    }
  }
  for (const gr of m.games) for (const s of [...gr.statsA, ...gr.statsB]) {
    if (!g.records.gameScore || s.score > g.records.gameScore.value) {
      const p = g.players[s.pid]; if (p) g.records.gameScore = { value: s.score, label: `${p.tag} (${t.short})`, date: g.date };
    }
  }
  for (const pid of [...ids.A, ...ids.B]) { const p = g.players[pid]; if (p) p.value = marketValue(g, p); }
}

export interface SeriesAgg { pid: string; side: 'A' | 'B'; goals: number; assists: number; saves: number; shots: number; demos: number; score: number; rating: number; games: number }
export function aggregateSeries(m: Match): Map<string, SeriesAgg> {
  const map = new Map<string, SeriesAgg>();
  const add = (s: PlayerGameStats, side: 'A' | 'B') => {
    const cur = map.get(s.pid) ?? { pid: s.pid, side, goals: 0, assists: 0, saves: 0, shots: 0, demos: 0, score: 0, rating: 0, games: 0 };
    cur.goals += s.goals; cur.assists += s.assists; cur.saves += s.saves; cur.shots += s.shots; cur.demos += s.demos; cur.score += s.score;
    cur.rating = (cur.rating * cur.games + s.rating) / (cur.games + 1); cur.games++;
    map.set(s.pid, cur);
  };
  for (const gr of m.games) { gr.statsA.forEach(s => add(s, 'A')); gr.statsB.forEach(s => add(s, 'B')); }
  return map;
}

export function lastGame(m: Match): GameResult | undefined { return m.games[m.games.length - 1]; }
