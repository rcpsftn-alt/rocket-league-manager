import type { Archetype, Attributes, AttrKey, GameState, Hidden, Personality, Player, Playstyle, Position, Region, StatLine } from './types';
import { IQ_KEYS, MECH_KEYS, MENTAL_KEYS } from './types';
import { NATIONS, TAG_FULL, TAG_PARTS_A, TAG_PARTS_B } from './data';
import { addDays, ageOn, avg, clamp, gauss, newId, pick, rand, randInt, weighted, yearOf, daysBetween } from './util';

export const ATTR_LABEL: Record<AttrKey, string> = {
  carControl: 'Contrôle voiture', aerial: 'Contrôle aérien', flipResets: 'Flip resets', airDribble: 'Air dribbles',
  shooting: 'Précision de tir', power: 'Tirs puissants', ground: 'Mécanique au sol', recoveries: 'Récupérations',
  firstTouch: 'Premier contact', ballControl: 'Contrôle de balle', mechConsistency: 'Régularité mécanique',
  positioning: 'Placement', rotation: 'Rotations', decisions: 'Prise de décision', reading: 'Lecture du jeu',
  boost: 'Gestion du boost', defAwareness: 'Vigilance défensive', offAwareness: 'Vision offensive',
  challenge: 'Timing des challenges', adaptability: 'Adaptabilité',
  composure: 'Sang-froid', confidence: 'Confiance', consistency: 'Régularité', clutch: 'Clutch',
  pressure: 'Résistance à la pression', motivation: 'Motivation', professionalism: 'Professionnalisme',
  leadership: 'Leadership', discipline: 'Discipline',
};

const CA_MENTAL: AttrKey[] = ['composure', 'confidence', 'consistency', 'clutch', 'pressure'];
export function computeCA(a: Attributes): number {
  const mech = avg(MECH_KEYS.map(k => a[k]));
  const iq = avg(IQ_KEYS.map(k => a[k]));
  const men = avg(CA_MENTAL.map(k => a[k]));
  return mech * 0.44 + iq * 0.41 + men * 0.15;
}
export const ca = (p: Player) => computeCA(p.attrs);
export const mechScore = (p: Player) => avg(MECH_KEYS.map(k => p.attrs[k]));
export const iqScore = (p: Player) => avg(IQ_KEYS.map(k => p.attrs[k]));
export const mentalScore = (p: Player) => avg(MENTAL_KEYS.map(k => p.attrs[k]));
export const age = (g: GameState, p: Player) => ageOn(p.birth, g.date);
export const displayName = (p: Player) => `${p.firstName} "${p.tag}" ${p.lastName}`;

export function emptyStats(): StatLine { return { games: 0, wins: 0, goals: 0, assists: 0, saves: 0, shots: 0, demos: 0, mvps: 0, ratingSum: 0, score: 0 }; }

// ---------------------------------------------------------------- archetypes
type Mod = Partial<Record<AttrKey, number>>;
const ARCH_MODS: Record<Archetype, Mod> = {
  'Superstar': { shooting: 4, aerial: 4, decisions: 3, clutch: 5, confidence: 5 },
  'Prospect élite': { aerial: 4, airDribble: 5, flipResets: 5, positioning: -3, rotation: -3, composure: -3 },
  'Prodige mécanique': { aerial: 8, airDribble: 10, flipResets: 11, ground: 7, ballControl: 6, rotation: -7, positioning: -6, decisions: -5, boost: -4 },
  'Spécialiste tactique': { positioning: 7, rotation: 8, decisions: 7, reading: 7, boost: 6, flipResets: -9, airDribble: -7, ground: -3 },
  'Spécialiste défensif': { defAwareness: 9, positioning: 6, recoveries: 6, challenge: 5, offAwareness: -6, flipResets: -6, shooting: -4 },
  'Vétéran': { decisions: 6, reading: 7, positioning: 5, composure: 6, leadership: 8, flipResets: -7, airDribble: -6, recoveries: -3 },
  'Irrégulier à haut plafond': { aerial: 6, airDribble: 6, shooting: 5, power: 6, consistency: -14, mechConsistency: -10, composure: -6 },
  'Agent libre sous-coté': { consistency: 5, rotation: 4, discipline: 4 },
  'Talent régional': { confidence: -3 },
  'Joueur de rotation': { rotation: 4, boost: 3, discipline: 3 },
};
const ARCH_STYLE: Partial<Record<Archetype, Playstyle[]>> = {
  'Prodige mécanique': ['Mécanique', 'Agressif'],
  'Spécialiste tactique': ['Playmaker', 'Support'],
  'Spécialiste défensif': ['Ancre défensive', 'Support'],
  'Vétéran': ['Playmaker', 'Support', 'Ancre défensive'],
  'Irrégulier à haut plafond': ['Agressif', 'Mécanique'],
};
const PERSONALITIES: Personality[] = ['Leader', 'Calme', 'Perfectionniste', 'Explosif', 'Discret', 'Compétiteur', 'Mercenaire', 'Loyal', 'Fêtard', 'Professionnel'];

export function makeTag(existing: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    let t = rand() < 0.45 ? pick(TAG_FULL) : pick(TAG_PARTS_A) + pick(TAG_PARTS_B);
    if (rand() < 0.12) t = t.toLowerCase();
    if (rand() < 0.06) t = t + randInt(1, 99);
    if (!existing.has(t.toLowerCase())) { existing.add(t.toLowerCase()); return t; }
  }
  const t = pick(TAG_PARTS_A) + randInt(100, 999); existing.add(t.toLowerCase()); return t;
}

export function pickNation(region: Region) {
  return weighted(NATIONS[region], n => n.weight);
}

export interface GenOpts { region: Region; ca: number; age: number; archetype?: Archetype; potential?: number; tags: Set<string> }

export function generatePlayer(g: GameState, o: GenOpts): Player {
  const nation = pickNation(o.region);
  const archetype = o.archetype ?? pickArchetype(o.age, o.ca);
  const mods = ARCH_MODS[archetype];
  const attrs = {} as Attributes;
  const all: AttrKey[] = [...MECH_KEYS, ...IQ_KEYS, ...MENTAL_KEYS];
  // age shapes the profile: youngsters mechanical, veterans smart
  const ageShift = clamp((o.age - 21) * 0.9, -5, 7);
  for (const k of all) {
    let v = o.ca + gauss(0, 5.5) + (mods[k] ?? 0);
    if ((MECH_KEYS as readonly string[]).includes(k)) v -= ageShift * 0.6;
    if ((IQ_KEYS as readonly string[]).includes(k)) v += ageShift * 0.7;
    attrs[k] = v;
  }
  for (const k of ['motivation', 'professionalism', 'leadership', 'discipline'] as AttrKey[]) attrs[k] = 50 + gauss(0, 13) + (mods[k] ?? 0) + (o.age - 20);
  // normalise to target CA
  const diff = o.ca - computeCA(attrs);
  for (const k of all) attrs[k] = clamp(attrs[k] + diff, 8, 99);
  const caNow = computeCA(attrs);

  const youth = clamp((24 - o.age) / 7, 0, 1);
  let potential = o.potential ?? clamp(caNow + Math.abs(gauss(0, 1)) * 11 * youth + rand() * 3 * youth + 1, caNow, 96);
  if (archetype === 'Prospect élite' && o.potential == null) potential = clamp(Math.max(potential, randInt(84, 95)), caNow, 97);
  if (archetype === 'Irrégulier à haut plafond' && o.potential == null) potential = clamp(potential + 5, caNow, 97);
  const hidden: Hidden = {
    potential,
    ambition: randInt(4, 20), loyalty: randInt(3, 20), personality: pick(PERSONALITIES),
    pressureSensitivity: clamp(randInt(2, 18) - (archetype === 'Superstar' ? 5 : 0) + (archetype === 'Irrégulier à haut plafond' ? 4 : 0), 1, 20),
    injuryProneness: randInt(1, 16), profCeiling: randInt(6, 20),
  };
  const positions: Position[] = [1, 2, 3];
  let position: Position = pick(positions);
  const style: Playstyle = ARCH_STYLE[archetype] ? pick(ARCH_STYLE[archetype]!) :
    pick(['Agressif', 'Playmaker', 'Mécanique', 'Support', 'Ancre défensive'] as Playstyle[]);
  if (style === 'Ancre défensive') position = 3; else if (style === 'Agressif' && rand() < 0.6) position = 1;
  const birthYear = yearOf(g.date) - o.age;
  const birth = `${birthYear}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`;
  const rep = clamp((caNow - 55) * 2.6 + gauss(0, 5), 1, 99);
  const p: Player = {
    id: newId(g, 'p'),
    firstName: pick(nation.first), lastName: pick(nation.last), tag: makeTag(o.tags),
    nationality: nation.code, region: o.region, birth,
    orgId: null, squadRole: null, position, playstyle: style, archetype,
    attrs, hidden,
    cond: { fatigue: randInt(5, 25), form: 50 + gauss(0, 8), morale: 60 + gauss(0, 10), burnout: randInt(0, 15), injuredUntil: null },
    contract: null, value: 0, reputation: rep, popularity: clamp(rep * 0.9 + gauss(0, 8), 1, 99),
    followers: Math.round(Math.exp(rep / 14) * 900 * (0.6 + rand())),
    careerEarnings: Math.round(Math.max(0, (o.age - 16)) * Math.exp(rep / 22) * 1500),
    achievements: [], season: emptyStats(), career: emptyStats(), recentRatings: [], retired: false, history: [], joinedOrgDate: null,
  };
  // seed career stats proportional to experience
  const yrs = Math.max(0, o.age - 17);
  p.career.games = Math.round(yrs * randInt(40, 110) * (rep / 60 + 0.3));
  p.career.goals = Math.round(p.career.games * (0.7 + rand() * 0.4)); p.career.saves = Math.round(p.career.games * (1 + rand() * 0.6));
  p.career.assists = Math.round(p.career.games * 0.5); p.career.shots = Math.round(p.career.goals * 3);
  p.career.wins = Math.round(p.career.games * (0.4 + rep / 300)); p.career.ratingSum = p.career.games * (6 + rep / 100);
  p.value = marketValue(g, p);
  return p;
}

function pickArchetype(age: number, c: number): Archetype {
  if (c >= 86) return rand() < 0.7 ? 'Superstar' : pick(['Prodige mécanique', 'Spécialiste tactique'] as Archetype[]);
  if (age <= 19 && rand() < 0.35) return pick(['Prospect élite', 'Prodige mécanique', 'Irrégulier à haut plafond'] as Archetype[]);
  if (age >= 26 && rand() < 0.4) return 'Vétéran';
  return weighted<Archetype>(['Spécialiste tactique', 'Spécialiste défensif', 'Prodige mécanique', 'Irrégulier à haut plafond', 'Talent régional', 'Joueur de rotation', 'Agent libre sous-coté'], a =>
    ({ 'Spécialiste tactique': 2, 'Spécialiste défensif': 2, 'Prodige mécanique': 1.5, 'Irrégulier à haut plafond': 1, 'Talent régional': 3, 'Joueur de rotation': 3, 'Agent libre sous-coté': 1 } as Record<string, number>)[a] ?? 1);
}

// ---------------------------------------------------------------- economy
export function yearsLeft(g: GameState, p: Player) { return p.contract ? Math.max(0, daysBetween(g.date, p.contract.end) / 365) : 0; }

export function marketValue(g: GameState, p: Player): number {
  const c = ca(p);
  const a = age(g, p);
  const pa = p.hidden.potential;
  const youth = clamp((23 - a) / 6, 0, 1);
  const eff = c + Math.max(0, pa - c) * 0.45 * youth;
  let v = 2500 * Math.exp((eff - 50) / 7.6);
  v *= 0.75 + p.reputation / 200 + p.popularity / 400;
  if (a >= 27) v *= clamp(1 - (a - 26) * 0.08, 0.35, 1);
  const form = avg(p.recentRatings.slice(-8));
  if (form) v *= clamp(0.85 + (form - 6.5) * 0.15, 0.7, 1.3);
  return Math.round(v / 500) * 500;
}

/** The fee an org needs to accept: depends on contract length and squad importance. */
export function askingFee(g: GameState, p: Player): number {
  if (!p.contract) return 0;
  const yl = yearsLeft(g, p);
  let fee = p.value * (0.45 + Math.min(yl, 2.5) * 0.35);
  if (p.squadRole === 'starter') fee *= 1.25;
  if (p.askingOffer) fee = Math.min(fee, p.askingOffer);
  if (p.contract.buyout > 0) fee = Math.min(fee, p.contract.buyout);
  return Math.round(fee / 500) * 500;
}

export function salaryDemand(g: GameState, p: Player, orgRep: number): number {
  const c = ca(p);
  let s = 900 * Math.exp((c - 50) / 12.5);
  s *= 0.8 + p.reputation / 250 + p.hidden.ambition / 60;
  // stronger orgs get a "prestige discount", weaker orgs pay a premium
  s *= clamp(1.18 - orgRep / 230, 0.8, 1.2);
  if (p.cond.morale < 35) s *= 1.08;
  return Math.max(500, Math.round(s / 50) * 50);
}

/** Starting contract for generated players at world creation */
export function defaultContract(g: GameState, p: Player, orgRep: number) {
  const yrs = randInt(1, 3);
  const end = `${yearOf(g.date) + yrs - 1}-12-31`;
  const salary = salaryDemand(g, p, orgRep) * (0.85 + rand() * 0.25);
  p.contract = {
    salary: Math.round(salary / 50) * 50, start: addDays(g.date, -randInt(30, 600)), end,
    buyout: rand() < 0.3 ? Math.round(p.value * (1.4 + rand()) / 1000) * 1000 : 0,
    signingBonus: 0, winBonus: Math.round(salary * 0.5 / 100) * 100, prizeShare: 0.8,
  };
}

export function avgRating(s: StatLine) { return s.games ? s.ratingSum / s.games : 0; }
export function recentForm(p: Player) { return p.recentRatings.length ? avg(p.recentRatings.slice(-6)) : 0; }

// Scouting: how precisely the user sees an attribute
export function knowledge(g: GameState, p: Player): number {
  if (p.orgId && p.orgId === g.userOrgId) return 100;
  return g.scout[p.id] ?? 0;
}
export function fuzzy(g: GameState, p: Player, v: number): [number, number] {
  const k = knowledge(g, p);
  if (k >= 95) return [Math.round(v), Math.round(v)];
  const spread = Math.round((100 - k) / 7) + 1;
  // stable per player/value so ranges don't flicker
  const off = ((p.id.charCodeAt(p.id.length - 1) + Math.round(v)) % 5) - 2;
  const c = clamp(Math.round(v) + Math.round(off * (100 - k) / 100), 1, 99);
  return [clamp(c - spread, 1, 99), clamp(c + spread, 1, 99)];
}
export function potentialStars(g: GameState, p: Player): number | null {
  const k = knowledge(g, p);
  if (k < 45) return null;
  const err = k >= 90 ? 0 : ((p.id.charCodeAt(1) % 3) - 1) * (100 - k) / 12;
  return clamp(Math.round(((p.hidden.potential + err) - 40) / 11.5 * 2) / 2, 0.5, 5);
}
export function abilityStars(v: number) { return clamp(Math.round((v - 40) / 11.5 * 2) / 2, 0.5, 5); }
