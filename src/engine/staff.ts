import type { GameState, Region, Staff, StaffRole } from './types';
import { NATIONS, STAFF_FIRST } from './data';
import { clamp, gauss, newId, pick, randInt, weighted } from './util';

let _sidx: { g: GameState; date: string; map: Map<string, Staff[]> } | null = null;
/** Invalidate the staff-by-org index (call after any hire/fire). */
export function touchStaff() { _sidx = null; }
export function staffOf(g: GameState, orgId: string): Staff[] {
  if (!_sidx || _sidx.g !== g || _sidx.date !== g.date) {
    const map = new Map<string, Staff[]>();
    for (const s of Object.values(g.staff)) if (s.orgId) { const l = map.get(s.orgId); if (l) l.push(s); else map.set(s.orgId, [s]); }
    _sidx = { g, date: g.date, map };
  }
  return (_sidx.map.get(orgId) ?? []).filter(s => s.orgId === orgId);
}
export function hireStaff(g: GameState, s: Staff, orgId: string, salary: number, years: number) {
  s.orgId = orgId; s.salary = salary; s.contractEnd = `${+g.date.slice(0, 4) + years - (g.date.slice(5) >= '10-01' ? 0 : 1)}-12-31`;
  touchStaff();
}
export function fireStaff(g: GameState, s: Staff) {
  s.orgId = null; s.contractEnd = null; s.scoutRegion = null;
  touchStaff();
}
export function staffByRole(g: GameState, orgId: string, role: StaffRole): Staff | undefined {
  return staffOf(g, orgId).filter(s => s.role === role).sort((a, b) => staffQuality(b) - staffQuality(a))[0];
}
export function staffQuality(s: Staff): number {
  const a = s.attrs;
  switch (s.role) {
    case 'Head coach': return (a.tactics * 2 + a.mechanics + a.mental + a.motivation * 1.5) / 5.5;
    case 'Assistant coach': return (a.tactics + a.mechanics * 1.5 + a.motivation) / 3.5;
    case 'Analyste': return (a.analysis * 2 + a.tactics) / 3;
    case 'Performance coach': return (a.fitness * 2 + a.motivation) / 3;
    case 'Mental coach': return (a.mental * 2 + a.motivation) / 3;
    case 'Academy coach': return (a.youth * 2 + a.mechanics) / 3;
    case 'Recruteur': return (a.analysis * 2 + a.youth) / 3;
  }
}

export function generateStaff(g: GameState, region: Region, role: StaffRole, level: number): Staff {
  const nation = weighted(NATIONS[region], n => n.weight);
  const r = () => clamp(Math.round(level + gauss(0, 2.5)), 1, 20);
  const s: Staff = {
    id: newId(g, 's'), name: `${pick(STAFF_FIRST)} ${pick(nation.last)}`, nationality: nation.code, region, role,
    age: randInt(24, 52),
    attrs: { mechanics: r(), tactics: r(), mental: r(), fitness: r(), youth: r(), analysis: r(), motivation: r() },
    reputation: 0, salary: 0, orgId: null, contractEnd: null, scoutRegion: null,
  };
  // specialise
  const boost: Record<StaffRole, (keyof Staff['attrs'])[]> = {
    'Head coach': ['tactics', 'motivation'], 'Assistant coach': ['mechanics'], 'Analyste': ['analysis', 'tactics'],
    'Performance coach': ['fitness'], 'Mental coach': ['mental'], 'Academy coach': ['youth'], 'Recruteur': ['analysis', 'youth'],
  };
  for (const k of boost[role]) s.attrs[k] = clamp(s.attrs[k] + randInt(1, 4), 1, 20);
  const q = staffQuality(s);
  s.reputation = clamp(Math.round(q * 5 + gauss(0, 6)), 1, 99);
  s.salary = Math.round((600 + Math.pow(q, 2.15) * 14) / 50) * 50;
  return s;
}

export function staffSalaryDemand(s: Staff, orgRep: number) {
  return Math.round(s.salary * clamp(1.15 - orgRep / 300, 0.85, 1.15) / 50) * 50;
}
