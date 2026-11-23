// ============================================================================
// Match simulation engine.
// A game is simulated as a sequence of ~8-second "phases". Each phase resolves
// possession, chance creation, shot quality vs. save quality, demos and
// rotations from the players' attributes, condition, chemistry and tactics.
// Randomness only enters as bounded noise around these structural values.
// ============================================================================
import type { GameResult, GameState, MatchEvent, Org, Player, PlayerGameStats, Position, Tactic } from './types';
import { avg, chance, clamp, gauss, pick, rand, sigmoid, weighted } from './util';
import { teamChemistry } from './chemistry';
import { staffOf } from './staff';

export interface SimPlayer {
  p: Player;
  pos: Position;
  atk: number; def: number; ctrl: number; iq: number; mech: number;
  clutch: number; day: number; // per-game performance swing
}
export interface SideCtx {
  orgId: string;
  name: string;
  tag: string;
  players: SimPlayer[];
  tactic: Tactic;
  chem: number;
  analysis: number; // analyst quality 0..1
  // derived
  attack: number; defense: number; control: number; rotation: number; demoRate: number; tempo: number;
}

export const DEFAULT_TACTIC: Tactic = { pressure: 0, tempo: 0, boostControl: 1, demos: 1, challenges: 0, rotation: 'standard' };

function condMult(p: Player) {
  const c = p.cond;
  return 1 + (c.form - 50) / 260 - Math.max(0, c.fatigue - 20) / 330 + (c.morale - 50) / 420 - c.burnout / 900;
}

let NOISE = true;
/** Deterministic team profile for UI previews (no random day form). */
export function previewSide(g: GameState, org: Org, lineup: Player[], tactic?: Tactic): SideCtx {
  NOISE = false;
  try { return buildSide(g, org, lineup, 0.3, tactic); } finally { NOISE = true; }
}

function buildPlayer(p: Player, pos: Position, importance: number): SimPlayer {
  const a = p.attrs;
  const m = condMult(p);
  // pressure: importance amplifies mental strength vs. hidden sensitivity
  const mental = (a.composure + a.pressure + a.confidence) / 3;
  const press = importance * ((mental - 60) / 330 - (p.hidden.pressureSensitivity - 10) / 260);
  const consist = (a.consistency + a.mechConsistency) / 2;
  const day = NOISE ? gauss(0, clamp((105 - consist) / 900, 0.012, 0.09)) : 0;
  const k = m * (1 + press + day);
  const atk = (a.shooting * 0.24 + a.power * 0.1 + a.aerial * 0.15 + a.airDribble * 0.09 + a.flipResets * 0.07 + a.ground * 0.1 + a.ballControl * 0.1 + a.offAwareness * 0.15) * k;
  const def = (a.defAwareness * 0.24 + a.positioning * 0.2 + a.recoveries * 0.14 + a.challenge * 0.14 + a.aerial * 0.1 + a.reading * 0.18) * k;
  const ctrl = (a.firstTouch * 0.2 + a.ballControl * 0.2 + a.carControl * 0.2 + a.challenge * 0.2 + a.boost * 0.2) * k;
  const iq = (a.rotation * 0.3 + a.decisions * 0.25 + a.reading * 0.25 + a.positioning * 0.2) * k;
  const mech = (a.carControl + a.aerial + a.ground + a.recoveries) / 4 * k;
  return { p, pos, atk, def, ctrl, iq, mech, clutch: (a.clutch - 50) / 50, day };
}

export function buildSide(g: GameState, org: Org, lineup: Player[], importance: number, tacticOverride?: Tactic): SideCtx {
  const players = lineup.map((p, i) => buildPlayer(p, (org.positions[p.id] ?? ((i + 1) as Position)), importance));
  // collective "day" of the team: correlated swing, the main source of upsets
  const teamDay = NOISE ? 1 + gauss(0, K.teamDay) : 1;
  for (const sp of players) { sp.atk *= teamDay; sp.def *= teamDay; sp.ctrl *= teamDay; sp.iq *= teamDay; }
  const tactic = tacticOverride ?? org.tactic ?? DEFAULT_TACTIC;
  const chem = teamChemistry(g, org, lineup.map(p => p.id));
  const analyst = staffOf(g, org.id).filter(s => s.role === 'Analyste' || s.role === 'Head coach');
  const analysis = analyst.length ? Math.max(...analyst.map(s => s.attrs.analysis)) / 20 : 0.2;
  const side: SideCtx = { orgId: org.id, name: org.name, tag: org.tag, players, tactic, chem, analysis, attack: 0, defense: 0, control: 0, rotation: 0, demoRate: 0, tempo: 0 };
  recompute(side);
  return side;
}

/** Derives team-level values from individuals + chemistry + composition + tactics. */
export function recompute(s: SideCtx) {
  const ps = s.players;
  const t = s.tactic;
  const chemMult = 0.9 + (s.chem / 100) * 0.2;
  // role / composition fit
  let fit = 1;
  const posCount: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const sp of ps) {
    posCount[sp.pos]++;
    if (sp.p.position !== sp.pos) fit -= 0.025;
  }
  if (posCount[3] === 0) fit -= 0.05;
  if (posCount[1] === 0) fit -= 0.03;
  const styles = ps.map(sp => sp.p.playstyle);
  const attackers = styles.filter(x => x === 'Agressif' || x === 'Mécanique').length;
  const defenders = styles.filter(x => x === 'Ancre défensive' || x === 'Support').length;
  const playmakers = styles.filter(x => x === 'Playmaker').length;
  let atkComp = 1, defComp = 1;
  if (attackers === 3) { atkComp += 0.04; defComp -= 0.09; }
  if (defenders === 0) defComp -= 0.04;
  if (defenders === 3) { atkComp -= 0.08; defComp += 0.03; }
  if (playmakers >= 1) atkComp += 0.02;
  if (playmakers >= 2) defComp -= 0.02;

  const posW = (sp: SimPlayer, kind: 'atk' | 'def') => kind === 'atk' ? (sp.pos === 1 ? 1.3 : sp.pos === 2 ? 1.05 : 0.65) : (sp.pos === 3 ? 1.35 : sp.pos === 2 ? 1.0 : 0.65);
  const wAvg = (kind: 'atk' | 'def') => {
    let tot = 0, w = 0;
    for (const sp of ps) { const ww = posW(sp, kind); tot += (kind === 'atk' ? sp.atk : sp.def) * ww; w += ww; }
    return tot / w;
  };
  const iq = avg(ps.map(sp => sp.iq));
  const rotStyle = t.rotation === 'tight' ? 1.03 : t.rotation === 'loose' ? 0.97 : 1;
  // aggressive pressure strains rotations of low-IQ teams
  const rotStrain = Math.max(0, t.pressure) * (0.018 - (iq - 60) / 4000) + Math.max(0, t.challenges) * 0.012;
  s.rotation = iq * chemMult * fit * rotStyle * (1 - rotStrain - t.demos * 0.008);
  s.attack = wAvg('atk') * atkComp * fit * (1 + t.pressure * 0.045 + (t.rotation === 'loose' ? 0.03 : 0) - t.boostControl * 0.01) * (0.95 + chemMult * 0.05);
  s.defense = wAvg('def') * defComp * fit * (1 - t.pressure * 0.04 + (t.rotation === 'tight' ? 0.03 : 0) - Math.max(0, t.challenges) * 0.015) * (0.95 + chemMult * 0.05);
  const chalSkill = avg(ps.map(sp => sp.p.attrs.challenge));
  s.control = avg(ps.map(sp => sp.ctrl)) * (1 + t.boostControl * 0.03 + t.challenges * (chalSkill - 65) / 2500) * chemMult;
  s.demoRate = 0.045 * (0.6 + t.demos * 0.55) * (1 + Math.max(0, t.pressure) * 0.15);
  s.tempo = t.tempo;
}

// --------------------------------------------------------------------------
// Sensitivity of each phase to skill gaps (higher = flatter, more upsets)
export const K = { ctrl: 60, rot: 90, shot: 55, goal: 26, teamDay: 0.055 };
const GOAL_LINES = [
  (s: string, a?: string) => a ? `${s} conclut une action léchée de ${a} !` : `${s} trouve le chemin des filets !`,
  (s: string, a?: string) => a ? `Passe millimétrée de ${a}, ${s} n'a plus qu'à pousser !` : `Frappe surpuissante de ${s} !`,
  (s: string, a?: string) => a ? `${s} reprend le centre aérien de ${a} — BUT !` : `${s} sort un air dribble et marque !`,
  (s: string) => `Flip reset de ${s}... et c'est au fond !`,
  (s: string) => `${s} punit une rotation ratée !`,
  (s: string) => `Double touch de ${s} au-dessus du gardien !`,
];
const SAVE_LINES = [
  (d: string, s: string) => `Énorme arrêt de ${d} devant ${s} !`,
  (d: string, s: string) => `${d} s'interpose sur la frappe de ${s}.`,
  (d: string) => `${d} sort la balle de la ligne !`,
  (d: string, s: string) => `Tentative de ${s}, ${d} capte proprement.`,
];

export interface LiveState {
  t: number; scoreA: number; scoreB: number; ot: boolean; over: boolean;
  momentum: number; // + favours A
  possA: number; phases: number;
  stats: Map<string, PlayerGameStats>;
  events: MatchEvent[];
}

export class GameSim {
  st: LiveState;
  constructor(public A: SideCtx, public B: SideCtx, public importance: number, public seriesPressure = 0) {
    const stats = new Map<string, PlayerGameStats>();
    for (const sp of [...A.players, ...B.players]) stats.set(sp.p.id, { pid: sp.p.id, goals: 0, assists: 0, saves: 0, shots: 0, demos: 0, score: 0, rating: 0, touches: 0 });
    this.st = { t: 0, scoreA: 0, scoreB: 0, ot: false, over: false, momentum: 0, possA: 0, phases: 0, stats, events: [] };
    this.st.events.push({ t: 0, kind: 'kickoff', team: 0, text: `Coup d'envoi ! ${A.tag} vs ${B.tag}` });
  }

  private add(st: PlayerGameStats, k: keyof PlayerGameStats, v = 1) { (st[k] as number) += v; }

  /** Advance one phase (~8s). Returns events produced. */
  step(): MatchEvent[] {
    const s = this.st;
    if (s.over) return [];
    const out: MatchEvent[] = [];
    const tempo = (this.A.tempo + this.B.tempo) / 2;
    const dt = Math.round(clamp(8.2 - tempo * 0.7 + gauss(0, 1.2), 5, 12));
    s.t += dt;
    s.phases++;
    const late = !s.ot && s.t > 240 && Math.abs(s.scoreA - s.scoreB) <= 1;
    const clutchW = (late || s.ot ? 1 : 0) * (0.6 + this.importance * 0.6) + this.seriesPressure * 0.5;

    // tempo matchup: fast games favour mechanics, slow games favour IQ
    const mechEdge = (avg(this.A.players.map(p => p.mech)) - avg(this.B.players.map(p => p.mech))) / 100;
    const iqEdge = (avg(this.A.players.map(p => p.iq)) - avg(this.B.players.map(p => p.iq))) / 100;
    const tempoEdge = tempo > 0 ? mechEdge * tempo * 0.6 : iqEdge * -tempo * 0.6;
    const clutchEdge = clutchW * (avg(this.A.players.map(p => p.clutch)) - avg(this.B.players.map(p => p.clutch))) * 0.35;
    const analysisEdge = (this.A.analysis - this.B.analysis) * 0.12;

    const pA = sigmoid((this.A.control - this.B.control) / K.ctrl + (this.A.rotation - this.B.rotation) / K.rot + s.momentum + tempoEdge + clutchEdge + analysisEdge + gauss(0, 0.35));
    const atkA = rand() < pA;
    if (atkA) s.possA++;
    const att = atkA ? this.A : this.B, def = atkA ? this.B : this.A;
    const sideIdx: 0 | 1 = atkA ? 0 : 1;

    // touches
    for (const sp of att.players) if (rand() < 0.55) this.add(s.stats.get(sp.p.id)!, 'touches');
    for (const sp of def.players) if (rand() < 0.3) this.add(s.stats.get(sp.p.id)!, 'touches');

    // demos (both directions, the attacker more likely)
    for (const [dSide, vSide, idx] of [[att, def, sideIdx], [def, att, (1 - sideIdx) as 0 | 1]] as [SideCtx, SideCtx, 0 | 1][]) {
      if (rand() < dSide.demoRate * (dSide === att ? 1.2 : 0.7)) {
        const dem = weighted(dSide.players, sp => 1 + (sp.p.playstyle === 'Agressif' ? 1.2 : 0) + (sp.pos === 1 ? 0.8 : 0));
        const vic = pick(vSide.players);
        this.add(s.stats.get(dem.p.id)!, 'demos'); this.add(s.stats.get(dem.p.id)!, 'score', 25);
        out.push({ t: s.t, kind: 'demo', team: idx, pid: dem.p.id, pid2: vic.p.id, text: `${dem.p.tag} démolit ${vic.p.tag}.` });
      }
    }
    const demoed = out.some(e => e.kind === 'demo' && e.team === sideIdx);

    // chance creation
    const diff = (att.attack - def.defense) + (att.rotation - def.rotation) * 0.5;
    const pressure = att.tactic.pressure;
    let pShot = clamp(sigmoid(0.0 + diff / K.shot + pressure * 0.12 + (demoed ? 0.5 : 0) + (atkA ? s.momentum : -s.momentum) * 0.5) * 0.82, 0.12, 0.88);
    // game-state management: a team far ahead slows down and protects its lead
    const lead = (atkA ? s.scoreA - s.scoreB : s.scoreB - s.scoreA);
    if (lead >= 3) pShot *= 1 / (1 + 0.35 * (lead - 2));
    let attempts = 0;
    while (attempts < 3 && rand() < pShot) {
      attempts++;
      const shooter = weighted(att.players, sp => sp.atk * (sp.pos === 1 ? 1.35 : sp.pos === 2 ? 1.1 : 0.65) * (1 + (sp.p.playstyle === 'Mécanique' ? 0.15 : 0)));
      const sst = s.stats.get(shooter.p.id)!;
      this.add(sst, 'shots'); this.add(sst, 'score', 20);
      const keeper = weighted(def.players, sp => sp.def * (sp.pos === 3 ? 2.2 : sp.pos === 2 ? 1 : 0.5));
      const q = shooter.atk * (1 + clutchW * shooter.clutch * 0.05) + gauss(0, 7) + (demoed ? 6 : 0);
      const sv = keeper.def * (1 + clutchW * keeper.clutch * 0.05) + def.rotation * 0.15 + gauss(0, 7) - 10;
      const pGoal = clamp(sigmoid(-0.95 + (q - sv) / K.goal), 0.06, 0.8);
      if (rand() < pGoal) {
        this.add(sst, 'goals'); this.add(sst, 'score', 100);
        let assister: SimPlayer | undefined;
        const others = att.players.filter(x => x !== shooter);
        if (rand() < 0.55 + (att.players.some(x => x.p.playstyle === 'Playmaker') ? 0.12 : 0)) {
          assister = weighted(others, sp => sp.iq + (sp.p.playstyle === 'Playmaker' ? 25 : 0));
          this.add(s.stats.get(assister.p.id)!, 'assists'); this.add(s.stats.get(assister.p.id)!, 'score', 50);
        }
        if (atkA) s.scoreA++; else s.scoreB++;
        s.momentum = clamp((atkA ? 1 : -1) * 0.28 + s.momentum * 0.4, -0.6, 0.6);
        const line = pick(GOAL_LINES)(shooter.p.tag, assister?.p.tag);
        out.push({ t: s.t, kind: 'goal', team: sideIdx, pid: shooter.p.id, pid2: assister?.p.id, text: `BUT ${att.tag} ! ${line} (${s.scoreA}-${s.scoreB})` });
        if (s.ot) { this.finish(out); s.events.push(...out); return out; }
        break;
      } else {
        if (rand() < 0.7) {
          const kst = s.stats.get(keeper.p.id)!;
          this.add(kst, 'saves'); this.add(kst, 'score', q - sv > 8 ? 75 : 50);
          if (q - sv > 4 || rand() < 0.25) out.push({ t: s.t, kind: 'save', team: (1 - sideIdx) as 0 | 1, pid: keeper.p.id, pid2: shooter.p.id, text: pick(SAVE_LINES)(keeper.p.tag, shooter.p.tag) });
        } else if (rand() < 0.3) {
          out.push({ t: s.t, kind: 'shot', team: sideIdx, pid: shooter.p.id, text: `${shooter.p.tag} tente sa chance... à côté.` });
        }
        pShot *= 0.45; // rebound chance
      }
    }
    // momentum decays
    s.momentum *= 0.72;
    if (s.phases % 9 === 0 && Math.abs(s.momentum) > 0.12) {
      const side = s.momentum > 0 ? this.A : this.B;
      out.push({ t: s.t, kind: 'pressure', team: s.momentum > 0 ? 0 : 1, text: `${side.tag} met une grosse pression dans le camp adverse.` });
    }
    // end of regulation
    if (!s.ot && s.t >= 300) {
      s.t = 300;
      if (s.scoreA !== s.scoreB) { this.finish(out); }
      else { s.ot = true; out.push({ t: 300, kind: 'info', team: 0, text: `Égalité ${s.scoreA}-${s.scoreB} — PROLONGATION ! But en or.` }); }
    }
    if (s.ot && s.t > 300 + 420 && !s.over) { // safety: decide long OTs by control
      if (rand() < pA) s.scoreA++; else s.scoreB++;
      out.push({ t: s.t, kind: 'goal', team: s.scoreA > s.scoreB ? 0 : 1, text: `Délivrance en prolongation !` });
      this.finish(out);
    }
    s.events.push(...out);
    return out;
  }

  private finish(out: MatchEvent[]) {
    const s = this.st;
    s.over = true;
    const winA = s.scoreA > s.scoreB;
    for (const [side, won] of [[this.A, winA], [this.B, !winA]] as [SideCtx, boolean][]) {
      for (const sp of side.players) {
        const st = s.stats.get(sp.p.id)!;
        st.score += st.touches * 6;
        st.rating = clamp(4.1 + st.score / 145 + (won ? 0.45 : -0.1) + sp.day * 3, 2.5, 10);
        st.rating = Math.round(st.rating * 10) / 10;
      }
    }
    const e: MatchEvent = { t: s.t, kind: 'end', team: winA ? 0 : 1, text: `Fin du match : ${this.A.tag} ${s.scoreA} - ${s.scoreB} ${this.B.tag}${s.ot ? ' (prol.)' : ''}` };
    out.push(e);
  }

  runToEnd() { let guard = 0; while (!this.st.over && guard++ < 400) this.step(); }

  result(keepEvents = false): GameResult {
    const s = this.st;
    return {
      scoreA: s.scoreA, scoreB: s.scoreB, ot: s.ot, otSeconds: s.ot ? s.t - 300 : 0,
      statsA: this.A.players.map(sp => ({ ...s.stats.get(sp.p.id)! })),
      statsB: this.B.players.map(sp => ({ ...s.stats.get(sp.p.id)! })),
      possessionA: s.phases ? s.possA / s.phases : 0.5,
      events: keepEvents ? s.events.filter(e => e.kind !== 'shot' || rand() < 0.5) : undefined,
    };
  }
}

/** Light per-game swing between games of a series (fatigue/tilt). */
export function betweenGames(side: SideCtx, lost: boolean, importance: number) {
  for (const sp of side.players) {
    const comp = sp.p.attrs.composure;
    const tilt = lost ? (0.012 - (comp - 50) / 4000) * (1 + importance) : -0.004;
    const k = 1 - tilt;
    sp.atk *= k; sp.def *= k; sp.ctrl *= k; sp.iq *= k;
  }
  recompute(side);
}
