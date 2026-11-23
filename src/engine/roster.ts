import type { GameState, Org, Player, Position, SquadRole } from './types';
import { ca } from './player';
import { pruneChemistry } from './chemistry';
import { addDays } from './util';

let _pidx: { g: GameState; map: Map<string, Player[]> } | null = null;
/** Invalidate the players-by-org index (joinOrg/leaveOrg do it automatically). */
export function touchPlayers() { _pidx = null; }
export function orgPlayers(g: GameState, orgId: string): Player[] {
  if (!_pidx || _pidx.g !== g) {
    const map = new Map<string, Player[]>();
    for (const p of Object.values(g.players)) if (p.orgId) { const l = map.get(p.orgId); if (l) l.push(p); else map.set(p.orgId, [p]); }
    _pidx = { g, map };
  }
  return (_pidx.map.get(orgId) ?? []).filter(p => p.orgId === orgId && !p.retired && g.players[p.id] === p);
}
export const starters = (g: GameState, orgId: string) => orgPlayers(g, orgId).filter(p => p.squadRole === 'starter');

export function isAvailable(g: GameState, p: Player) {
  return !p.cond.injuredUntil || p.cond.injuredUntil <= g.date;
}

/** Match lineup: 3 starters (replaced by subs/academy if unavailable), sorted by assigned position. */
export function lineup(g: GameState, org: Org): Player[] {
  const all = orgPlayers(g, org.id).filter(p => isAvailable(g, p));
  const order = (r: SquadRole | null) => (r === 'starter' ? 0 : r === 'sub' ? 1 : 2);
  all.sort((a, b) => order(a.squadRole) - order(b.squadRole) || ca(b) - ca(a));
  const lu = all.slice(0, 3);
  if (lu.length < 3) {
    // emergency stand-ins: best free agents of the region (not signed)
    const fa = Object.values(g.players).filter(p => !p.orgId && !p.retired && p.region === org.region).sort((a, b) => ca(b) - ca(a));
    for (const p of fa) { if (lu.length >= 3) break; if (!lu.includes(p)) lu.push(p); }
  }
  return lu.sort((a, b) => (org.positions[a.id] ?? a.position) - (org.positions[b.id] ?? b.position));
}

/** AI and fallback: make the 3 best players starters with sensible positions. */
export function autoLineup(g: GameState, org: Org) {
  const ps = orgPlayers(g, org.id).filter(p => p.squadRole !== 'academy' || ca(p) > 70);
  ps.sort((a, b) => ca(b) - ca(a));
  ps.forEach((p, i) => { p.squadRole = i < 3 ? 'starter' : 'sub'; });
  assignPositions(g, org);
}
export function assignPositions(g: GameState, org: Org) {
  const st = starters(g, org.id);
  const used = new Set<Position>();
  const byPref = [...st].sort((a, b) => a.position - b.position);
  for (const p of byPref) {
    let pos = org.positions[p.id];
    if (!pos || used.has(pos)) pos = used.has(p.position) ? ([1, 2, 3] as Position[]).find(x => !used.has(x))! : p.position;
    org.positions[p.id] = pos; used.add(pos);
  }
  if (!org.captainId || !st.some(p => p.id === org.captainId)) {
    const cap = [...st].sort((a, b) => b.attrs.leadership - a.attrs.leadership)[0];
    org.captainId = cap?.id ?? null;
  }
}

export function joinOrg(g: GameState, p: Player, org: Org, role: SquadRole) {
  const prev = p.orgId ? g.orgs[p.orgId] : null;
  if (prev) leaveOrg(g, p);
  _pidx = null;
  p.orgId = org.id; p.squadRole = role; p.joinedOrgDate = g.date; p.askingOffer = undefined; p.unhappy = 0;
  org.positions[p.id] = p.position;
  p.history.push({ season: g.season, orgId: org.id, orgName: org.name });
  const cur = role === 'starter' ? starters(g, org.id) : [];
  if (cur.length > 3) { const worst = cur.filter(x => x.id !== p.id).sort((a, b) => ca(a) - ca(b))[0]; worst.squadRole = 'sub'; }
  assignPositions(g, org);
}

export function leaveOrg(g: GameState, p: Player) {
  const org = p.orgId ? g.orgs[p.orgId] : null;
  _pidx = null;
  p.orgId = null; p.squadRole = null; p.joinedOrgDate = null; p.askingOffer = undefined;
  if (org) {
    delete org.positions[p.id];
    if (org.captainId === p.id) org.captainId = null;
    pruneChemistry(org, new Set(orgPlayers(g, org.id).map(x => x.id)));
    if (!org.isUser && starters(g, org.id).length < 3) autoLineup(g, org);
  }
}

export const contractEndFor = (g: GameState, years: number) => `${+g.date.slice(0, 4) + years - (g.date.slice(5) >= '10-01' ? 0 : 1)}-12-31`;
export const tomorrow = (g: GameState) => addDays(g.date, 1);
