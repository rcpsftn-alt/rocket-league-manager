// ============================================================================
// Season rollover: history, retirements, regens, contracts, org churn.
// ============================================================================
import type { GameState, Player, SeasonHistory } from './types';
import { REGIONS } from './types';
import { REGION_INFO } from './data';
import { ageOn, chance, clamp, gauss, rand, randInt } from './util';
import { avgRating, ca, emptyStats, generatePlayer, marketValue, defaultContract } from './player';
import { autoLineup, leaveOrg, orgPlayers, starters, joinOrg } from './roster';
import { interestIn, demandedTerms, completeSigning } from './transfers';
import { createSeasonCalendar } from './competitions';
import { addNews, inbox } from './news';
import { createOrg, disbandOrg, boardObjective } from './world';
import { generateStaff, touchStaff } from './staff';

export function seasonSummary(g: GameState): SeasonHistory {
  const champs = Object.values(g.tournaments).filter(t => t.season === g.season && t.status === 'done').sort((a, b) => a.start.localeCompare(b.start)).map(t => {
    const w = t.placements.find(p => p.rank === 1), r = t.placements.find(p => p.rank === 2);
    return { tournament: t.name, kind: t.kind, region: t.region, winnerId: w?.teamId ?? '', winnerName: g.orgs[w?.teamId ?? '']?.name ?? '?', runnerUpName: g.orgs[r?.teamId ?? '']?.name ?? '?', mvp: t.mvpId ? g.players[t.mvpId]?.tag : undefined };
  });
  const pts = g.circuitPoints[g.season] ?? {};
  const topTeams = Object.values(g.orgs).filter(o => !o.disbanded).sort((a, b) => b.elo - a.elo).slice(0, 20).map(o => ({ orgId: o.id, name: o.name, elo: o.elo, points: pts[o.id] ?? 0 }));
  const topPlayers = Object.values(g.players).filter(p => p.season.games >= 20).sort((a, b) => avgRating(b.season) - avgRating(a.season)).slice(0, 20).map(p => ({ pid: p.id, tag: p.tag, orgName: p.orgId ? g.orgs[p.orgId].name : 'Agent libre', rating: Math.round(avgRating(p.season) * 100) / 100 }));
  return { season: g.season, champions: champs, topTeams, topPlayers };
}

function retirementChance(g: GameState, p: Player) {
  const a = ageOn(p.birth, g.date);
  const c = ca(p);
  let r = 0;
  if (a >= 26) r += (a - 25) * 0.05;
  if (!p.orgId && a >= 23) r += 0.12 + (60 - c) / 100;
  if (c < 45 && a >= 21) r += 0.2;
  if (p.cond.burnout > 70) r += 0.1;
  return clamp(r, 0, 0.9);
}

export function endSeason(g: GameState) {
  const hist = seasonSummary(g);
  const uOrg = g.userOrgId ? g.orgs[g.userOrgId] : null;
  if (uOrg) {
    const trophies = uOrg.trophies.filter(t => t.season === g.season).map(t => t.tournament);
    const pts = g.circuitPoints[g.season]?.[uOrg.id] ?? 0;
    hist.userSummary = `${uOrg.name} — ${pts} pts circuit, Elo ${uOrg.elo}${trophies.length ? `, titres : ${trophies.join(', ')}` : ''}`;
    g.manager.history.push({ season: g.season, orgName: uOrg.name, result: trophies.length ? `${trophies.length} titre(s)` : `${pts} pts` });
    g.manager.experience++;
    g.manager.reputation = clamp(g.manager.reputation + 2 + trophies.length * 4 + (pts > 300 ? 3 : 0), 0, 100);
  }
  g.history.push(hist);
  g.rankingHistory.push({ date: g.date, top: hist.topTeams.slice(0, 20).map(t => ({ orgId: t.orgId, elo: t.elo })) });
  for (const p of hist.topPlayers.slice(0, 3)) { const pl = g.players[p.pid]; if (pl) pl.achievements.push(`Top ${hist.topPlayers.indexOf(p) + 1} joueur mondial ${g.season}`); }
  addNews(g, { kind: 'world', title: `Bilan ${g.season} : ${hist.topTeams[0]?.name} termine n°1 mondial`, body: `Meilleur joueur de la saison : ${hist.topPlayers[0]?.tag ?? '—'} (${hist.topPlayers[0]?.orgName ?? ''}).`, orgIds: [], playerIds: [], important: true });

  // strip detailed stats of the finished season to bound save size
  for (const m of Object.values(g.matches)) {
    const t = g.tournaments[m.tournamentId];
    if (t && t.season <= g.season - 1) { m.games = m.games.map(gr => ({ ...gr, statsA: [], statsB: [], events: undefined })); }
  }
}

/** Called on Jan 1 of the new season. */
export function startNewSeason(g: GameState) {
  const prev = g.season;
  g.season = prev + 1;
  const tags = new Set(Object.values(g.players).map(p => p.tag.toLowerCase()));

  // contract expiries
  for (const p of Object.values(g.players)) {
    if (p.retired || !p.contract || p.contract.end > `${prev}-12-31`) continue;
    const org = p.orgId ? g.orgs[p.orgId] : null;
    if (!org) { p.contract = null; continue; }
    if (org.isUser) {
      inbox(g, `${p.tag} quitte le club (fin de contrat)`, `Le contrat de ${p.tag} n'a pas été prolongé. Il devient agent libre.`);
      leaveOrg(g, p); p.contract = null;
      continue;
    }
    const st = starters(g, org.id);
    const keep = p.squadRole === 'starter' ? ca(p) >= Math.min(...st.map(ca)) - 2 : ca(p) > 60 && chance(0.4);
    const willing = interestIn(g, p, org, p.squadRole ?? 'sub').score > -0.5;
    if (keep && willing && org.balance > 0) {
      const t = demandedTerms(g, p, org, p.squadRole ?? 'starter');
      t.signingBonus = 0; t.years = randInt(1, 2);
      completeSigning(g, p, org, t, 0);
    } else {
      leaveOrg(g, p); p.contract = null;
      if (ca(p) > 75) addNews(g, { kind: 'transfer', title: `${p.tag} libre de tout contrat`, body: `${p.tag} n'a pas prolongé avec ${org.name} et arrive sur le marché des agents libres.`, orgIds: [org.id], playerIds: [p.id], important: false });
    }
  }
  // staff contracts
  for (const s of Object.values(g.staff)) {
    if (!s.orgId || !s.contractEnd || s.contractEnd > `${prev}-12-31`) continue;
    const org = g.orgs[s.orgId];
    if (org?.isUser) { inbox(g, `${s.name} quitte le staff`, `Fin de contrat de ${s.role}.`); s.orgId = null; s.contractEnd = null; }
    else if (chance(0.75)) s.contractEnd = `${g.season + randInt(0, 1)}-12-31`;
    else { s.orgId = null; s.contractEnd = null; }
  }
  touchStaff();
  // retirements
  let retired = 0;
  for (const p of Object.values(g.players)) {
    if (p.retired) continue;
    if (chance(retirementChance(g, p))) {
      const famous = p.reputation > 60 || (p.orgId && g.orgs[p.orgId]?.isUser);
      if (p.orgId) leaveOrg(g, p);
      p.retired = true; p.contract = null; retired++;
      if (famous) addNews(g, { kind: 'player', title: `${p.tag} annonce sa retraite`, body: `À ${ageOn(p.birth, g.date)} ans, ${p.firstName} "${p.tag}" ${p.lastName} met un terme à sa carrière (${p.career.games} matchs, ${p.achievements.filter(a => a.startsWith('Champion')).length} titre(s)).`, orgIds: [], playerIds: [p.id], important: !!(p.orgId && g.orgs[p.orgId]?.isUser) });
    }
  }
  // regens: new talents enter the scene
  let created = 0;
  for (const r of REGIONS) {
    const n = Math.round((retired / 7) + (r === 'EU' || r === 'NA' ? 9 : 6));
    for (let i = 0; i < n; i++) {
      const wonder = chance(0.06);
      const p = generatePlayer(g, { region: r, ca: clamp(44 + gauss(0, 6) + (wonder ? 10 : 0) + (REGION_INFO[r].strength - 0.9) * 25, 30, 72), age: randInt(15, 18), tags, archetype: wonder ? 'Prospect élite' : undefined, potential: wonder ? randInt(86, 97) : undefined });
      g.players[p.id] = p; created++;
      if (wonder && chance(0.5)) addNews(g, { kind: 'player', title: `Un jeune prodige émerge en ${REGION_INFO[r].name}`, body: `${p.tag}, ${ageOn(p.birth, g.date)} ans, fait parler de lui en ranked. Les recruteurs sont sur le coup.`, orgIds: [], playerIds: [p.id], important: false });
    }
  }
  // org churn: bankrupt AI orgs disband, new ones replace them
  for (const o of Object.values(g.orgs)) {
    if (o.isUser || o.disbanded) continue;
    if (o.balance < -80000 && o.negativeMonths >= 6) {
      disbandOrg(g, o, `Criblée de dettes, ${o.name} met la clé sous la porte.`);
      const used = new Set(Object.values(g.orgs).map(x => x.name.split(' ').find(w => w.length > 3) ?? x.name));
      const nw = createOrg(g, o.region, randInt(1, 3), used);
      nw.founded = g.season;
      const fa = Object.values(g.players).filter(p => !p.orgId && !p.retired && p.region === o.region).sort((a, b) => ca(b) - ca(a));
      for (const p of fa.slice(randInt(0, 6), randInt(0, 6) + 3)) { joinOrg(g, p, nw, 'starter'); defaultContract(g, p, nw.reputation); }
      const coach = generateStaff(g, nw.region, 'Head coach', randInt(5, 12)); coach.orgId = nw.id; coach.contractEnd = `${g.season + 1}-12-31`; g.staff[coach.id] = coach; touchStaff();
      autoLineup(g, nw);
      addNews(g, { kind: 'club', title: `${nw.name} rejoint le circuit ${REGION_INFO[nw.region].name}`, body: `Une nouvelle organisation reprend la place laissée vacante.`, orgIds: [nw.id], playerIds: [], important: false });
    }
  }
  // free staff pool refresh
  for (const r of REGIONS) for (let i = 0; i < 2; i++) { const s = generateStaff(g, r, pick7(), randInt(4, 17)); g.staff[s.id] = s; }
  // reset season stats, elo regression, condition reset
  for (const p of Object.values(g.players)) {
    if (p.retired) continue;
    p.season = emptyStats();
    p.cond.fatigue = Math.max(0, p.cond.fatigue - 30); p.cond.burnout = Math.max(0, p.cond.burnout - 25);
    p.value = marketValue(g, p);
    if (p.orgId) p.history.push({ season: g.season, orgId: p.orgId, orgName: g.orgs[p.orgId].name });
  }
  for (const o of Object.values(g.orgs)) {
    if (o.disbanded) continue;
    o.elo = Math.round(o.elo * 0.9 + 1600 * 0.1);
    if (!o.isUser) autoLineup(g, o);
  }
  const u = g.userOrgId ? g.orgs[g.userOrgId] : null;
  if (u) { u.objective = boardObjective(g, u); inbox(g, `Saison ${g.season} : objectifs du board`, `Objectif : ${u.objective}.`, { kind: 'screen', id: 'club' }); }
  createSeasonCalendar(g, g.season);
  // prune very old data
  const cutoff = g.season - 3;
  for (const [id, m] of Object.entries(g.matches)) { const t = g.tournaments[m.tournamentId]; if (!t || t.season < cutoff) delete g.matches[id]; }
  for (const t of Object.values(g.tournaments)) if (t.season < cutoff) for (const s of t.stages) s.matchIds = s.matchIds.filter(id => g.matches[id]);
  for (const [id, p] of Object.entries(g.players)) if (p.retired && p.reputation < 50 && ageOn(p.birth, g.date) > 34) delete g.players[id];
  addNews(g, { kind: 'world', title: `La saison ${g.season} est lancée`, body: `${retired} joueurs ont pris leur retraite, ${created} jeunes talents font leur apparition.`, orgIds: [], playerIds: [], important: false });
}

const ROLES7 = ['Head coach', 'Assistant coach', 'Analyste', 'Performance coach', 'Mental coach', 'Academy coach', 'Recruteur'] as const;
function pick7() { return ROLES7[Math.floor(rand() * ROLES7.length)]; }
export { orgPlayers };
