import type { GameState, Org, Player } from './types';
import { avg, clamp } from './util';

export const chemKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const CLASH: [string, string][] = [['Explosif', 'Perfectionniste'], ['Explosif', 'Explosif'], ['Mercenaire', 'Loyal'], ['Fêtard', 'Professionnel'], ['Leader', 'Leader']];
const BOND: [string, string][] = [['Calme', 'Explosif'], ['Leader', 'Discret'], ['Professionnel', 'Perfectionniste'], ['Compétiteur', 'Leader'], ['Loyal', 'Loyal']];

/** Static personality/playstyle compatibility in [-15, +15]. */
export function compatibility(a: Player, b: Player): number {
  let c = 0;
  const pa = a.hidden.personality, pb = b.hidden.personality;
  if (CLASH.some(([x, y]) => (x === pa && y === pb) || (x === pb && y === pa))) c -= 9;
  if (BOND.some(([x, y]) => (x === pa && y === pb) || (x === pb && y === pa))) c += 7;
  if (a.nationality === b.nationality) c += 4;
  if (a.playstyle === b.playstyle && (a.playstyle === 'Agressif' || a.playstyle === 'Mécanique')) c -= 4;
  if (a.playstyle !== b.playstyle) c += 2;
  return clamp(c, -15, 15);
}

export function pairChem(g: GameState, org: Org, a: Player, b: Player): number {
  const k = chemKey(a.id, b.id);
  if (org.chemistry[k] == null) org.chemistry[k] = clamp(28 + compatibility(a, b), 5, 60);
  return org.chemistry[k];
}

export function teamChemistry(g: GameState, org: Org, ids: string[]): number {
  const ps = ids.map(id => g.players[id]).filter(Boolean);
  if (ps.length < 2) return 30;
  const vals: number[] = [];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) vals.push(pairChem(g, org, ps[i], ps[j]));
  const comm = avg(ps.map(p => (p.attrs.leadership + p.attrs.discipline) / 2));
  return clamp(avg(vals) + (comm - 55) / 8, 0, 100);
}

/** Called after every series and chemistry training. */
export function growChemistry(g: GameState, org: Org, ids: string[], amount: number) {
  const ps = ids.map(id => g.players[id]).filter(Boolean);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const k = chemKey(ps[i].id, ps[j].id);
    const cur = pairChem(g, org, ps[i], ps[j]);
    const comp = compatibility(ps[i], ps[j]);
    const gain = amount * (1 + comp / 25) * (1 - cur / 115);
    org.chemistry[k] = clamp(cur + gain, 0, 100);
  }
}

export function pruneChemistry(org: Org, memberIds: Set<string>) {
  for (const k of Object.keys(org.chemistry)) {
    const [a, b] = k.split('|');
    if (!memberIds.has(a) || !memberIds.has(b)) delete org.chemistry[k];
  }
}
