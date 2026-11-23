// ============================================================================
// Finances: monthly cycle (wages, sponsors, merch, content, operations),
// forecasts, debt and bankruptcy risk.
// ============================================================================
import type { FinanceCategory, GameState, Org } from './types';
import { INCOME_CATS } from './types';
import { book } from './ledger';
import { leaveOrg, orgPlayers } from './roster';
import { staffOf } from './staff';
import { addDays, clamp, monthKey } from './util';
import { DIFFICULTY } from './data';
import { inbox, addNews } from './news';

export function monthlyWageBill(g: GameState, org: Org) {
  return orgPlayers(g, org.id).reduce((a, p) => a + (p.contract?.salary ?? 0), 0);
}
export function monthlyStaffBill(g: GameState, org: Org) {
  return staffOf(g, org.id).reduce((a, s) => a + s.salary, 0);
}
export function activeDeals(g: GameState, org: Org) {
  return org.sponsorIds.map(id => g.deals[id]).filter(d => d && d.active);
}
export function sponsorIncome(g: GameState, org: Org) { return activeDeals(g, org).reduce((a, d) => a + d.monthly, 0); }
export function totalFollowers(org: Org) { const s = org.social; return Math.round(s.x + s.tiktok + s.youtube + s.twitch + s.discord); }
export function merchIncome(org: Org) { return Math.round(org.fans * 0.25 * (0.6 + org.reputation / 120) * (0.8 + org.social.sentiment / 250)); }
export function contentIncome(org: Org) { const s = org.social; return Math.round((s.youtube * 0.035 + s.twitch * 0.06 + s.tiktok * 0.004 + s.x * 0.002) * (0.7 + s.engagement / 160)); }
/** Owners / investors injecting money every month (founder-run orgs get less). */
export function investorIncome(g: GameState, org: Org) {
  if (org.isUser && g.manager.founderOrgId === org.id) return Math.round((600 + org.reputation * 50) * DIFFICULTY[g.difficulty].sponsor);
  return Math.round((2000 + org.reputation * 130) * (org.isUser ? DIFFICULTY[g.difficulty].sponsor : 1));
}
export function opsCost(g: GameState, org: Org) {
  const d = DIFFICULTY[g.difficulty].costs;
  const n = orgPlayers(g, org.id).length;
  return Math.round((900 + org.facilities * 700 + org.academyLevel * 400 + n * 150) * d);
}
export const FACILITY_COST = [0, 0, 40000, 90000, 180000, 320000];
export const ACADEMY_COST = [0, 0, 25000, 60000, 120000, 220000];

export interface Forecast { income: Record<string, number>; expense: Record<string, number>; net: number }
export function forecastMonth(g: GameState, org: Org): Forecast {
  const income: Record<string, number> = {
    'Sponsors': sponsorIncome(g, org), 'Merchandising': merchIncome(org), 'Contenu & streaming': contentIncome(org), 'Autres revenus': investorIncome(g, org),
  };
  const expense: Record<string, number> = {
    'Salaires joueurs': monthlyWageBill(g, org), 'Salaires staff': monthlyStaffBill(g, org),
    'Infrastructures': opsCost(g, org), 'Marketing': org.marketingBudget,
    'Intérêts': Math.round(org.debt * 0.008),
  };
  const net = Object.values(income).reduce((a, b) => a + b, 0) - Object.values(expense).reduce((a, b) => a + b, 0);
  return { income, expense, net };
}

/** First day of each month. */
export function monthlyFinance(g: GameState) {
  const prevMonth = monthKey(addDays(g.date, -1));
  for (const org of Object.values(g.orgs)) {
    if (org.disbanded) continue;
    const f = forecastMonth(g, org);
    for (const [k, v] of Object.entries(f.income)) book(g, org.id, k as FinanceCategory, v, `${k} — ${prevMonth}`);
    for (const [k, v] of Object.entries(f.expense)) book(g, org.id, k as FinanceCategory, -v, `${k} — ${prevMonth}`);
    // automatic credit line when broke
    if (org.balance < 0) {
      const loan = Math.min(-org.balance + 5000, Math.max(0, 150000 * (org.reputation / 50) - org.debt));
      if (loan > 0) { org.debt += loan; org.balance += loan; if (org.isUser) g.ledger.push({ date: g.date, orgId: org.id, category: 'Autres revenus', amount: Math.round(loan), label: 'Ligne de crédit bancaire (dette)' }); }
    } else if (org.debt > 0 && org.balance > 50000) {
      const repay = Math.min(org.debt, org.balance - 50000, 20000);
      org.debt -= repay; org.balance -= repay;
      if (org.isUser) g.ledger.push({ date: g.date, orgId: org.id, category: 'Intérêts', amount: -Math.round(repay), label: 'Remboursement de dette' });
    }
    org.negativeMonths = org.balance < 0 || org.debt > 100000 * (org.reputation / 40) ? org.negativeMonths + 1 : Math.max(0, org.negativeMonths - 1);
    if (org.isUser) {
      const inc = g.ledger.filter(l => l.date === g.date && l.amount > 0).reduce((a, l) => a + l.amount, 0);
      const exp = g.ledger.filter(l => l.date === g.date && l.amount < 0).reduce((a, l) => a + l.amount, 0);
      inbox(g, `Bilan financier — ${prevMonth}`, `Revenus ${Math.round(inc).toLocaleString('fr-FR')} $ · Dépenses ${Math.round(-exp).toLocaleString('fr-FR')} $ · Trésorerie ${Math.round(org.balance).toLocaleString('fr-FR')} $${org.debt ? ` · Dette ${Math.round(org.debt).toLocaleString('fr-FR')} $` : ''}`, { kind: 'screen', id: 'finances' });
      if (org.negativeMonths >= 2) inbox(g, 'Alerte du board : situation financière', `Le board s'inquiète de la santé financière de ${org.name}. Réduisez la masse salariale ou trouvez des sponsors.`);
    } else if (org.negativeMonths >= 3 && org.balance < 0) {
      // AI cost-cutting: release most expensive sub
      const subs = orgPlayers(g, org.id).filter(p => p.squadRole !== 'starter').sort((a, b) => (b.contract?.salary ?? 0) - (a.contract?.salary ?? 0));
      if (subs[0]) { leaveOrg(g, subs[0]); subs[0].contract = null; }
      if (org.negativeMonths === 3) addNews(g, { kind: 'finance', title: `${org.name} en difficulté financière`, body: `Des sources internes évoquent des retards de paiement chez ${org.name}.`, orgIds: [org.id], playerIds: [], important: false });
    }
  }
  // monthly snapshot of user org
  const u = g.userOrgId ? g.orgs[g.userOrgId] : null;
  if (u) {
    const entries = g.ledger.filter(l => monthKey(l.date) === prevMonth || l.date === g.date);
    g.monthly.push({ month: prevMonth, orgId: u.id, income: entries.filter(l => l.amount > 0).reduce((a, l) => a + l.amount, 0), expense: -entries.filter(l => l.amount < 0).reduce((a, l) => a + l.amount, 0), balance: Math.round(u.balance) });
    if (g.monthly.length > 240) g.monthly.shift();
  }
  if (g.ledger.length > 4000) g.ledger.splice(0, g.ledger.length - 4000);
}

export function bankruptcyRisk(g: GameState, org: Org): number {
  const f = forecastMonth(g, org);
  const runway = f.net >= 0 ? 99 : org.balance / -f.net;
  return clamp(Math.round((org.negativeMonths * 18 + (runway < 3 ? 35 : runway < 6 ? 15 : 0) + org.debt / 5000)), 0, 100);
}

export function summarize(g: GameState, orgId: string, fromDate: string) {
  const byCat: Record<string, number> = {};
  for (const l of g.ledger) if (l.orgId === orgId && l.date >= fromDate) byCat[l.category] = (byCat[l.category] ?? 0) + l.amount;
  const income = Object.entries(byCat).filter(([k]) => INCOME_CATS.includes(k as FinanceCategory)).reduce((a, [, v]) => a + v, 0);
  const expense = Object.entries(byCat).filter(([k]) => !INCOME_CATS.includes(k as FinanceCategory)).reduce((a, [, v]) => a + v, 0);
  return { byCat, income, expense };
}
