// ============================================================================
// AI organisations (non-transfer decisions), scouting, manager job market.
// ============================================================================
import type { GameState, Org, StaffRole } from './types';
import { REGIONS } from './types';
import { addDays, chance, clamp, pick, rand, randInt, shuffle } from './util';
import { autoLineup, starters, orgPlayers } from './roster';
import { staffByRole, staffQuality, staffOf, touchStaff } from './staff';
import { addNews, inbox } from './news';
import { DEFAULT_TACTIC } from './matchsim';
import { takeControl } from './world';
import { REGION_INFO } from './data';

function recentSeries(g: GameState, orgId: string, n: number) {
  return Object.values(g.matches).filter(m => m.played && (m.teamA === orgId || m.teamB === orgId)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
}

export function aiDailyTick(g: GameState) {
  for (const org of Object.values(g.orgs)) {
    if (org.isUser || org.disbanded) continue;
    // weekly housekeeping
    if (g.date.endsWith('-01') || g.date.endsWith('-15')) {
      autoLineup(g, org);
      // adapt tactics after a bad run
      const rs = recentSeries(g, org.id, 4);
      const losses = rs.filter(m => m.winner !== org.id).length;
      if (rs.length >= 3 && losses >= 3) {
        org.tactic = { ...DEFAULT_TACTIC, pressure: randInt(-2, 2), tempo: randInt(-1, 2), demos: randInt(0, 2), boostControl: randInt(0, 2), challenges: randInt(-1, 1), rotation: pick(['standard', 'tight', 'loose'] as const) };
        org.lastTacticChange = g.date;
      }
      // hire missing head coach
      if (!staffByRole(g, org.id, 'Head coach')) hireBestStaff(g, org, 'Head coach');
      if (org.reputation > 55 && !staffByRole(g, org.id, 'Analyste') && org.balance > 60000) hireBestStaff(g, org, 'Analyste');
    }
  }
  // scouting assignments (user's recruiters)
  if (g.userOrgId) {
    const scouts = staffOf(g, g.userOrgId).filter(s => s.role === 'Recruteur' || s.role === 'Analyste');
    for (const s of scouts) {
      const region = s.scoutRegion ?? (s.role === 'Recruteur' ? g.orgs[g.userOrgId].region : null);
      if (!region) continue;
      const pool = Object.values(g.players).filter(p => p.region === region && !p.retired && (g.scout[p.id] ?? 0) < 100 && p.orgId !== g.userOrgId);
      const n = Math.round(1 + s.attrs.analysis / 5);
      for (let i = 0; i < n && pool.length; i++) {
        const p = pool[Math.floor(rand() * pool.length)];
        g.scout[p.id] = clamp((g.scout[p.id] ?? 0) + 8 + s.attrs.analysis * 0.9, 0, 100);
      }
    }
  }
}

export function hireBestStaff(g: GameState, org: Org, role: StaffRole) {
  const pool = Object.values(g.staff).filter(s => !s.orgId && s.role === role && s.salary < Math.max(1500, org.balance / 30)).sort((a, b) => staffQuality(b) - staffQuality(a));
  const s = pool[0];
  if (!s) return;
  s.orgId = org.id; s.contractEnd = `${g.season + randInt(0, 2)}-12-31`;
  touchStaff();
}

/** End of a split: AI boards may fire head coaches after poor results. */
export function aiCoachCarousel(g: GameState, split: number) {
  const pts = g.splitPoints[`${g.season}-${split}`] ?? {};
  for (const r of REGIONS) {
    const orgs = Object.values(g.orgs).filter(o => o.region === r && !o.disbanded && !o.isUser);
    const ranked = orgs.slice().sort((a, b) => (pts[b.id] ?? 0) - (pts[a.id] ?? 0));
    for (const o of ranked.slice(-5)) {
      const expected = o.reputation > 55;
      if (expected && chance(0.4)) {
        const hc = staffByRole(g, o.id, 'Head coach');
        if (hc) {
          hc.orgId = null; hc.contractEnd = null; touchStaff(); hc.reputation = Math.max(1, hc.reputation - 8);
          addNews(g, { kind: 'club', title: `${o.name} se sépare de son coach ${hc.name}`, body: `Après un split décevant, ${o.name} limoge ${hc.name}.`, orgIds: [o.id], playerIds: [], important: false });
          hireBestStaff(g, o, 'Head coach');
        }
        if (chance(0.25)) o.managerVacancy = true;
      }
    }
  }
}

// ---------------------------------------------------------------- manager job market
export function vacancies(g: GameState): Org[] {
  return Object.values(g.orgs).filter(o => o.managerVacancy && !o.disbanded && !o.isUser);
}

export function applyForJob(g: GameState, orgId: string) {
  if (g.manager.applications.some(a => a.orgId === orgId && a.status === 'pending')) return 'Candidature déjà envoyée.';
  g.manager.applications.push({ orgId, date: g.date, status: 'pending' });
  return `Candidature envoyée à ${g.orgs[orgId].name}. Réponse sous quelques jours.`;
}

export function jobMarketTick(g: GameState) {
  // new vacancies appear from time to time
  if (chance(0.02)) {
    const cands = Object.values(g.orgs).filter(o => !o.disbanded && !o.isUser && !o.managerVacancy);
    if (cands.length) { const o = pick(cands); o.managerVacancy = true; if (!g.userOrgId) addNews(g, { kind: 'club', title: `${o.name} cherche un nouveau manager`, body: `Le poste de manager de ${o.name} est vacant.`, orgIds: [o.id], playerIds: [], important: false }); }
  }
  if (!g.userOrgId && vacancies(g).length < 3) {
    // unemployed managers always have a few low-tier options
    for (const o of shuffle(Object.values(g.orgs).filter(x => !x.disbanded && x.reputation < 40)).slice(0, 2)) o.managerVacancy = true;
  }
  for (const a of g.manager.applications) {
    if (a.status !== 'pending' || addDays(a.date, 4) > g.date) continue;
    const o = g.orgs[a.orgId];
    const m = g.manager;
    const score = m.reputation + m.experience * 4 + m.trophies.length * 6 - o.reputation * 0.8 + rand() * 25;
    if (score > 5 && !g.userOrgId && o.managerVacancy) {
      a.status = 'accepted';
      o.managerVacancy = false;
      takeControl(g, o);
      inbox(g, `Vous êtes nommé manager de ${o.name} !`, `Le board vous confie l'organisation. Objectif : ${o.objective}.`, { kind: 'screen', id: 'dashboard' });
    } else {
      a.status = 'rejected';
      inbox(g, `${o.name} décline votre candidature`, score > -10 ? 'Votre profil était intéressant mais un autre candidat a été retenu.' : 'Votre expérience est jugée insuffisante pour ce poste.');
    }
  }
}

/** Monthly board review of the user's manager. Returns true if fired. */
export function boardReview(g: GameState): boolean {
  const org = g.userOrgId ? g.orgs[g.userOrgId] : null;
  if (!org) return false;
  const regionRank = Object.values(g.orgs).filter(o => o.region === org.region && !o.disbanded).sort((a, b) => b.elo - a.elo).findIndex(o => o.id === org.id) + 1;
  const target = org.objective.includes('Remporter') ? 2 : org.objective.includes('Major') ? 5 : org.objective.includes('playoffs') ? 8 : 12;
  let delta = (target - regionRank) * 0.6;
  if (org.balance < 0) delta -= 4;
  if (org.negativeMonths >= 2) delta -= 3;
  org.boardConfidence = clamp(org.boardConfidence + delta, 0, 100);
  const founder = g.manager.founderOrgId === org.id;
  if (org.boardConfidence <= 8 && !founder) {
    fireManager(g, org, 'Le board a perdu confiance dans votre projet.');
    return true;
  }
  if (org.negativeMonths >= 6 && org.balance < -50000) {
    if (founder) { g.gameOver = true; inbox(g, 'FAILLITE', `${org.name} est placée en liquidation. Votre carrière s'arrête ici.`); return true; }
    fireManager(g, org, 'La situation financière est intenable.');
    return true;
  }
  if (org.boardConfidence < 25) inbox(g, 'Avertissement du board', `Confiance du board : ${Math.round(org.boardConfidence)}%. Les résultats doivent s'améliorer rapidement.`);
  return false;
}

export function fireManager(g: GameState, org: Org, reason: string) {
  org.isUser = false;
  org.managerVacancy = false;
  g.manager.history.push({ season: g.season, orgName: org.name, result: 'Licencié' });
  g.manager.reputation = Math.max(5, g.manager.reputation - 8);
  g.userOrgId = null; g.manager.orgId = null; g.pendingUserMatch = null; g.negotiation = null;
  autoLineup(g, org);
  inbox(g, `Licencié par ${org.name}`, `${reason} Vous pouvez postuler auprès d'autres organisations depuis l'écran Club.`, { kind: 'screen', id: 'club' });
  addNews(g, { kind: 'board', title: `${org.name} limoge ${g.manager.name}`, body: reason, orgIds: [org.id], playerIds: [], important: true });
}

export const regionName = (r: string) => (REGION_INFO as Record<string, { name: string }>)[r]?.name ?? 'International';
export { orgPlayers, starters };
