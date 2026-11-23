// ============================================================================
// Time progression — the single orchestrator of the daily simulation.
// ============================================================================
import type { GameState, Match } from './types';
import { addDays, rngGet, rngSet } from './util';
import { trainingTick } from './training';
import { aiSponsorAcquisition, socialTick, sponsorMonthly } from './commercial';
import { aiTransferTick } from './transfers';
import { aiCoachCarousel, aiDailyTick, boardReview, jobMarketTick } from './ai';
import { monthlyFinance } from './finance';
import { playDay, progressTournament, startTournamentsToday } from './competitions';
import { applySeriesResult, simulateSeries } from './results';
import { endSeason, startNewSeason } from './season';
import { inbox } from './news';
import { orgPlayers } from './roster';
import { MAJOR_DATES } from './competitions';

export type StopReason = 'match' | 'event' | 'gameover' | null;

function withRng<T>(g: GameState, fn: () => T): T {
  rngSet(g.rngState);
  try { return fn(); } finally { g.rngState = rngGet(); }
}

function dailyTicks(g: GameState) {
  trainingTick(g);
  socialTick(g);
  aiTransferTick(g);
  aiDailyTick(g);
  jobMarketTick(g);
  if (g.date.endsWith('-01')) {
    monthlyFinance(g);
    sponsorMonthly(g);
    aiSponsorAcquisition(g);
    if (boardReview(g)) return;
  }
  // end of split coach carousel (day after each Major)
  MAJOR_DATES.forEach((d, i) => { if (g.date === addDays(`${g.season}-${d}`, 8)) aiCoachCarousel(g, i + 1); });
  // contract reminders
  if (g.date === `${g.season}-10-01` && g.userOrgId) {
    const exp = orgPlayers(g, g.userOrgId).filter(p => p.contract && p.contract.end <= `${g.season}-12-31`);
    if (exp.length) inbox(g, 'Contrats en fin de saison', `${exp.map(p => p.tag).join(', ')} arrivent en fin de contrat le 31 décembre. Prolongez-les depuis leur fiche.`, { kind: 'screen', id: 'squad' });
  }
  // Elo snapshots weekly
  if (g.date.endsWith('-01') || g.date.endsWith('-15')) {
    for (const o of Object.values(g.orgs)) {
      if (o.disbanded) continue;
      const h = (g.eloHistory[o.id] ??= []);
      h.push({ d: g.date, e: o.elo });
      if (h.length > 80) h.shift();
    }
  }
}

/** Advance one day. Returns why the simulation stopped (if it must). */
export function advanceDay(g: GameState): StopReason {
  return withRng(g, () => {
    if (g.gameOver) return 'gameover';
    if (g.pendingUserMatch && !g.matches[g.pendingUserMatch]?.played) return 'match';
    g.pendingUserMatch = null;
    const next = addDays(g.date, 1);
    if (next.slice(0, 4) !== g.date.slice(0, 4)) {
      endSeason(g);
      g.date = next;
      startNewSeason(g);
    } else g.date = next;
    dailyTicks(g);
    if (g.gameOver) return 'gameover';
    startTournamentsToday(g);
    const um = playDay(g);
    if (um) { g.pendingUserMatch = um.id; return 'match'; }
    return null;
  });
}

/** Continue until a user match, an actionable event, or `maxDays`. */
export function advanceUntilEvent(g: GameState, maxDays = 7): StopReason {
  const startInbox = g.inbox.filter(i => !i.read && i.action?.kind === 'offer').length;
  for (let i = 0; i < maxDays; i++) {
    const r = advanceDay(g);
    if (r) return r;
    const nowInbox = g.inbox.filter(x => !x.read && x.action?.kind === 'offer').length;
    if (nowInbox > startInbox) return 'event';
    if (g.negotiation) return 'event';
  }
  return null;
}

/** After the user's live/quick match is complete. Plays the rest of the day. */
export function finishUserMatch(g: GameState, m: Match) {
  withRng(g, () => {
    if (!m.played) applySeriesResult(g, m);
    // the user's opponents get scouted while playing
    const opp = m.teamA === g.userOrgId ? m.teamB : m.teamA;
    for (const p of orgPlayers(g, opp)) g.scout[p.id] = Math.min(100, (g.scout[p.id] ?? 0) + 20);
    for (const t of Object.values(g.tournaments)) if (t.status === 'live') progressTournament(g, t);
    g.pendingUserMatch = null;
    const um = playDay(g);
    if (um) g.pendingUserMatch = um.id;
  });
}

export function quickSimUserMatch(g: GameState, m: Match) {
  withRng(g, () => { simulateSeries(g, m); });
  finishUserMatch(g, m);
}

export { withRng };
