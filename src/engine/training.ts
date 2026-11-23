// ============================================================================
// Training & player development (daily tick)
// Growth = f(age curve, gap to potential, professionalism, staff quality,
// training focus & intensity, match experience). Overload => fatigue/burnout.
// ============================================================================
import type { AttrKey, GameState, IndividualFocus, Org, Player, TeamFocus } from './types';
import { IQ_KEYS, MECH_KEYS, MENTAL_KEYS } from './types';
import { ageOn, addDays, chance, clamp, gauss, rand, randInt } from './util';
import { ca, computeCA } from './player';
import { staffByRole, staffQuality } from './staff';
import { growChemistry } from './chemistry';
import { orgPlayers, starters } from './roster';
import { addNews, inbox } from './news';

const TEAM_FOCUS_ATTRS: Record<TeamFocus, AttrKey[]> = {
  'Équilibré': [...MECH_KEYS, ...IQ_KEYS],
  'Mécanique': ['carControl', 'aerial', 'flipResets', 'airDribble', 'ground', 'recoveries', 'firstTouch', 'ballControl', 'mechConsistency'],
  'Tactique': ['positioning', 'rotation', 'decisions', 'reading', 'boost', 'adaptability'],
  'Défense': ['defAwareness', 'positioning', 'recoveries', 'challenge', 'reading'],
  'Attaque': ['shooting', 'power', 'offAwareness', 'aerial', 'airDribble', 'ballControl'],
  'Cohésion': ['rotation', 'decisions', 'boost'],
  'Mental': ['composure', 'confidence', 'consistency', 'clutch', 'pressure'],
  'Récupération': [],
};
const IND_ATTRS: Record<IndividualFocus, AttrKey[]> = {
  'Aucun': [], 'Aérien': ['aerial', 'airDribble', 'flipResets'], 'Tirs': ['shooting', 'power'], 'Contrôle': ['firstTouch', 'ballControl', 'carControl', 'ground'],
  'Rotations': ['rotation', 'positioning'], 'Lecture du jeu': ['reading', 'decisions', 'adaptability'], 'Mental': ['composure', 'confidence', 'pressure'],
  'Boost': ['boost', 'challenge'], 'Récupérations': ['recoveries', 'mechConsistency'],
};
export const INTENSITY_LABEL = ['Repos', 'Légère', 'Normale', 'Intensive'];

/** Age multiplier on growth: fast before 21, slowing to 0 by 27, negative afterwards for mechanics. */
function ageCurve(age: number, kind: 'mech' | 'iq' | 'mental') {
  if (kind === 'mech') return age <= 18 ? 1.25 : age <= 21 ? 1 : age <= 24 ? 0.55 : age <= 26 ? 0.15 : -0.25 - (age - 27) * 0.12;
  if (kind === 'iq') return age <= 20 ? 0.9 : age <= 25 ? 0.75 : age <= 29 ? 0.35 : 0.05 - (age - 30) * 0.05;
  return age <= 22 ? 0.7 : age <= 28 ? 0.5 : 0.25;
}
const kindOf = (k: AttrKey): 'mech' | 'iq' | 'mental' => (MECH_KEYS as readonly string[]).includes(k) ? 'mech' : (IQ_KEYS as readonly string[]).includes(k) ? 'iq' : 'mental';

export function coachingFactor(g: GameState, org: Org | null, kind: 'mech' | 'iq' | 'mental' | 'youth') {
  if (!org) return 0.55;
  const hc = staffByRole(g, org.id, 'Head coach'), ac = staffByRole(g, org.id, 'Assistant coach');
  const mc = staffByRole(g, org.id, 'Mental coach'), yc = staffByRole(g, org.id, 'Academy coach');
  const fac = 0.85 + org.facilities * 0.06;
  let q = 6;
  if (kind === 'mech') q = Math.max(hc?.attrs.mechanics ?? 4, (ac?.attrs.mechanics ?? 0) + 1);
  if (kind === 'iq') q = Math.max(hc?.attrs.tactics ?? 4, (ac?.attrs.tactics ?? 0));
  if (kind === 'mental') q = Math.max(mc?.attrs.mental ?? 0, (hc?.attrs.mental ?? 4) - 2);
  if (kind === 'youth') q = Math.max(yc?.attrs.youth ?? 0, (hc?.attrs.mechanics ?? 4) - 3);
  return (0.5 + q / 20) * fac;
}

/** Daily development & condition for one player. */
interface OrgCache { mech: number; iq: number; mental: number; youth: number; perf: number; mentalQ: number }
function buildCache(g: GameState, org: Org | null): OrgCache {
  const perf = org ? staffByRole(g, org.id, 'Performance coach') : undefined;
  const mental = org ? staffByRole(g, org.id, 'Mental coach') : undefined;
  return {
    mech: coachingFactor(g, org, 'mech'), iq: coachingFactor(g, org, 'iq'), mental: coachingFactor(g, org, 'mental'), youth: coachingFactor(g, org, 'youth'),
    perf: perf ? staffQuality(perf) : 0, mentalQ: mental ? staffQuality(mental) : 0,
  };
}

function developPlayer(g: GameState, p: Player, cache: OrgCache, intensity: number, teamFocus: TeamFocus, ind: IndividualFocus) {
  const age = ageOn(p.birth, g.date);
  const cur = computeCA(p.attrs);
  const gap = p.hidden.potential - cur;
  const prof = p.attrs.professionalism / 100;
  const focusSet = new Set(TEAM_FOCUS_ATTRS[teamFocus]);
  const indSet = new Set(IND_ATTRS[ind]);
  const intens = [0.15, 0.65, 1, 1.35][intensity];
  const matchExp = p.recentRatings.length ? 1.1 : 0.9;
  const academy = p.squadRole === 'academy';
  for (const k of [...MECH_KEYS, ...IQ_KEYS, ...MENTAL_KEYS] as AttrKey[]) {
    if (k === 'motivation' || k === 'professionalism' || k === 'leadership' || k === 'discipline') continue;
    const kind = kindOf(k);
    const curve = ageCurve(age, kind);
    let delta: number;
    if (curve > 0) {
      if (gap <= 0.3) { delta = gauss(0, 0.004); }
      else {
        const coach = academy ? Math.max(cache[kind], cache.youth) : cache[kind];
        const focus = (focusSet.has(k) ? 1.35 : 0.8) * (indSet.has(k) ? 1.6 : 1);
        delta = 0.0052 * curve * Math.min(gap, 22) / 10 * (0.55 + prof) * coach * focus * intens * matchExp * (0.7 + rand() * 0.6);
      }
    } else {
      delta = 0.006 * curve * (1.3 - prof * 0.6) * (focusSet.has(k) ? 0.6 : 1);
    }
    p.attrs[k] = clamp(p.attrs[k] + delta, 5, 99);
  }
  // professionalism drifts toward ceiling
  p.attrs.professionalism = clamp(p.attrs.professionalism + (p.hidden.profCeiling * 5 - p.attrs.professionalism) * 0.0007, 10, 99);
}

function conditionTick(g: GameState, p: Player, org: Org | null, cache: OrgCache, intensity: number, focus: TeamFocus) {
  const c = p.cond;
  const recov = 1 + cache.perf / 30 + (focus === 'Récupération' ? 0.6 : 0);
  const load = [0, 0.8, 1.6, 2.7][intensity] * (focus === 'Récupération' ? 0.3 : 1);
  c.fatigue = clamp(c.fatigue + load - 2.1 * recov, 0, 100);
  // burnout builds when fatigue stays high
  const bGain = c.fatigue > 60 ? (c.fatigue - 60) / 40 * 1.1 : -0.55 - cache.mentalQ / 40;
  c.burnout = clamp(c.burnout + bGain - (focus === 'Mental' ? 0.2 : 0), 0, 100);
  // morale drifts to a baseline that depends on role and team results
  const base = 55 + (p.squadRole === 'starter' ? 8 : p.squadRole === 'sub' ? -6 : 0) + (p.attrs.confidence - 50) / 8;
  c.morale = clamp(c.morale + (base - c.morale) * 0.03 - (intensity === 3 ? 0.25 : 0) - (c.burnout > 70 ? 0.4 : 0), 3, 99);
  c.form = clamp(c.form + (50 - c.form) * 0.015, 5, 95);
  // injuries / burnout breaks
  if (!c.injuredUntil || c.injuredUntil <= g.date) {
    c.injuredUntil = null;
    const risk = 0.00025 * (1 + p.hidden.injuryProneness / 6) * (1 + c.fatigue / 45) + (c.burnout > 80 ? 0.006 : 0);
    if (chance(risk)) {
      const burn = c.burnout > 80;
      const days = burn ? randInt(10, 25) : randInt(4, 21);
      c.injuredUntil = addDays(g.date, days);
      if (burn) { c.burnout = 45; c.morale = Math.max(10, c.morale - 15); }
      if (org?.isUser) inbox(g, `${p.tag} indisponible ${days} jours`, burn ? `${p.tag} souffre d'un épuisement (burnout). Le staff impose une pause.` : `${p.tag} souffre d'une tendinite au poignet. Retour prévu le ${c.injuredUntil}.`);
      if (p.reputation > 60 || org?.isUser) addNews(g, { kind: 'player', title: burn ? `${p.tag} en pause pour burnout` : `${p.tag} blessé au poignet`, body: `${p.tag}${org ? ` (${org.tag})` : ''} sera absent environ ${days} jours.`, orgIds: org ? [org.id] : [], playerIds: [p.id], important: !!org?.isUser });
    }
  }
}

/** Daily: all players train (user org uses its plan, AI orgs a default balanced plan). */
export function trainingTick(g: GameState) {
  const inBootcamp = (o: Org) => !!o.bootcampUntil && o.bootcampUntil >= g.date;
  const orgs = g.orgs;
  const caches = new Map<string, OrgCache>();
  const freeCache = buildCache(g, null);
  for (const p of Object.values(g.players)) {
    if (p.retired) continue;
    const org = p.orgId ? orgs[p.orgId] : null;
    let intensity: number = org ? org.trainingFocus.intensity : 1;
    let focus: TeamFocus = org ? org.trainingFocus.focus : 'Équilibré';
    if (org && !org.isUser) { intensity = p.cond.fatigue > 55 ? 1 : 2; focus = p.cond.fatigue > 70 ? 'Récupération' : 'Équilibré'; }
    if (org && inBootcamp(org)) intensity = Math.min(3, intensity + 1);
    const ind = org?.individualTraining[p.id] ?? 'Aucun';
    let cache = freeCache;
    if (org) { cache = caches.get(org.id) ?? buildCache(g, org); caches.set(org.id, cache); }
    developPlayer(g, p, cache, intensity, focus, ind);
    conditionTick(g, p, org, cache, intensity, focus);
  }
  // team chemistry sessions
  for (const org of Object.values(orgs)) {
    if (org.disbanded) continue;
    const ids = starters(g, org.id).map(p => p.id);
    const f = org.isUser ? org.trainingFocus : { focus: 'Équilibré' as TeamFocus, intensity: 2 as const };
    const amt = (f.focus === 'Cohésion' ? 0.32 : 0.07) * [0.3, 0.7, 1, 1.25][f.intensity] * (inBootcamp(org) ? 2 : 1);
    if (ids.length >= 2) growChemistry(g, org, ids, amt);
  }
}

export function trainingPreview(g: GameState, org: Org) {
  // projected weekly CA gain for display
  return orgPlayers(g, org.id).map(p => ({ id: p.id, ca: ca(p) }));
}
