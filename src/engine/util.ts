import type { GameState } from './types';

// ---------------------------------------------------------------- RNG
// Seeded, serialisable PRNG (mulberry32). The state lives in GameState so a
// save resumes with the exact same random stream.
let _state = 1;
export function rngSet(s: number) { _state = s >>> 0 || 1; }
export function rngGet() { return _state; }
export function rand(): number {
  _state = (_state + 0x6d2b79f5) >>> 0;
  let t = _state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randInt = (a: number, b: number) => Math.floor(rand() * (b - a + 1)) + a;
export const randRange = (a: number, b: number) => a + rand() * (b - a);
export const chance = (p: number) => rand() < p;
export function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]; }
export function gauss(mean = 0, sd = 1): number {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function weighted<T>(items: T[], w: (t: T) => number): T {
  const ws = items.map(w);
  const tot = ws.reduce((a, b) => a + Math.max(0, b), 0);
  let r = rand() * tot;
  for (let i = 0; i < items.length; i++) { r -= Math.max(0, ws[i]); if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------------------------------------------------------------- math
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// ---------------------------------------------------------------- ids
export function newId(g: GameState, prefix: string) { g.idCounter++; return `${prefix}${g.idCounter.toString(36)}`; }

// ---------------------------------------------------------------- dates (ISO yyyy-mm-dd, UTC)
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
export function ageOn(birth: string, date: string): number {
  const b = new Date(birth + 'T00:00:00Z'), d = new Date(date + 'T00:00:00Z');
  let a = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) a--;
  return a;
}
export const yearOf = (iso: string) => +iso.slice(0, 4);
export const monthKey = (iso: string) => iso.slice(0, 7);
export const dayOfMonth = (iso: string) => +iso.slice(8, 10);
export function weekday(iso: string) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export function fmtDate(iso: string, withDay = false) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${withDay ? DAYS[weekday(iso)] + ' ' : ''}${d} ${MONTHS[m - 1]} ${y}`;
}
export function fmtShortDate(iso: string) { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; }

// ---------------------------------------------------------------- format
export function money(n: number, compact = true): string {
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (compact && a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (compact && a >= 1e4) return `${s}$${(a / 1e3).toFixed(0)}k`;
  if (compact && a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}k`;
  return `${s}$${Math.round(a).toLocaleString('fr-FR')}`;
}
export function num(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}
export function pct(n: number) { return `${Math.round(n * 100)}%`; }
