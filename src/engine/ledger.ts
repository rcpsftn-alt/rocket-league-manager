import type { FinanceCategory, GameState } from './types';

/** Single entry point for every money movement (keeps balance and ledger consistent). */
export function book(g: GameState, orgId: string, category: FinanceCategory, amount: number, label: string) {
  const org = g.orgs[orgId];
  if (!org || amount === 0) return;
  org.balance += amount;
  // Only the user's org keeps a detailed ledger (AI orgs only keep balance) to bound save size.
  if (org.isUser) g.ledger.push({ date: g.date, orgId, category, amount: Math.round(amount), label });
}
