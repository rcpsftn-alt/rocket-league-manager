// ============================================================================
// Transfer market, contract negotiation, releases, AI recruitment.
// AI organisations use exactly the same functions (fees, wages, willingness).
// ============================================================================
import type { ContractTerms, GameState, Org, Player, SquadRole, TransferOffer } from './types';
import { addDays, ageOn, avg, chance, clamp, daysBetween, money, newId, pick, rand, shuffle } from './util';
import { age, askingFee, ca, salaryDemand, yearsLeft } from './player';
import { joinOrg, leaveOrg, orgPlayers, starters, autoLineup, contractEndFor } from './roster';
import { book } from './ledger';
import { addNews, inbox } from './news';
import { forecastMonth, monthlyWageBill } from './finance';

// ---------------------------------------------------------------- windows
export function transferWindowOpen(g: GameState): boolean {
  const md = g.date.slice(5);
  return md >= '10-01' || md <= '01-14' || (md >= '03-31' && md <= '05-01') || (md >= '07-20' && md <= '08-20');
}
export function windowLabel(g: GameState) {
  if (transferWindowOpen(g)) return 'Mercato ouvert';
  const md = g.date.slice(5);
  const next = md < '03-31' ? '31 mars' : md < '07-20' ? '20 juillet' : '1er octobre';
  return `Mercato fermé (réouverture ${next})`;
}

// ---------------------------------------------------------------- player willingness
export function interestIn(g: GameState, p: Player, org: Org, role: SquadRole): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = (org.reputation - p.reputation * 0.85) / 14;
  if (org.reputation > p.reputation + 10) reasons.push('Attiré par le prestige de la structure');
  if (org.reputation < p.reputation - 15) reasons.push('Juge la structure trop modeste');
  const amb = p.hidden.ambition / 10;
  if (role === 'starter') s += 0.6 * amb; else if (role === 'sub') { s -= 1.1 * amb; reasons.push('Veut être titulaire'); } else s -= 0.3;
  if (!p.orgId) { s += 1.6; reasons.push('Libre, cherche un projet'); }
  if (p.region !== org.region) { s -= 1.0; reasons.push('Réticent à changer de région'); }
  const st = starters(g, org.id);
  if (st.length) {
    const lvl = avg(st.map(ca));
    s += (lvl - ca(p)) / 12;
    if (lvl > ca(p) + 4) reasons.push('Veut jouer avec de meilleurs coéquipiers');
  }
  const trophies = org.trophies.filter(t => t.season >= g.season - 1).length;
  s += Math.min(1.5, trophies * 0.4);
  if (p.orgId === org.id) { s += p.hidden.loyalty / 8 - (p.cond.morale < 40 ? 1.5 : 0); if (p.unhappy) { s -= 2; reasons.push('Mécontent de sa situation'); } }
  return { score: s, reasons };
}

export function demandedTerms(g: GameState, p: Player, org: Org, role: SquadRole): ContractTerms {
  const { score } = interestIn(g, p, org, role);
  let salary = salaryDemand(g, p, org.reputation) * clamp(1.12 - score * 0.05, 0.85, 1.45);
  if (p.orgId === org.id && p.contract) salary = Math.max(salary, p.contract.salary * 1.05);
  const a = age(g, p);
  const years = a >= 27 ? 2 : p.hidden.ambition > 14 && org.reputation < p.reputation ? 1 : a <= 20 ? 3 : 2;
  return {
    salary: Math.round(salary / 50) * 50, years, signingBonus: Math.round(salary * (p.orgId === org.id ? 0.5 : 1.5) / 100) * 100,
    winBonus: Math.round(salary * 0.4 / 100) * 100, prizeShare: 0.8, buyout: 0, role,
  };
}

function termsValue(t: ContractTerms, pref: ContractTerms) {
  const months = t.years * 12;
  let v = t.salary + t.signingBonus / months + t.winBonus * 0.12;
  v *= 1 + (t.prizeShare - 0.8) * 0.6;
  v *= 1 - Math.abs(t.years - pref.years) * 0.04;
  if (t.buyout > 0) v *= 1.02; // players like an exit door
  return v;
}

// ---------------------------------------------------------------- user-facing: offers to clubs
export interface OfferResponse { status: 'accepted' | 'rejected' | 'counter'; counterFee?: number; message: string }

export function clubResponse(g: GameState, p: Player, buyer: Org, fee: number): OfferResponse {
  const seller = p.orgId ? g.orgs[p.orgId] : null;
  if (!seller) return { status: 'accepted', message: 'Agent libre : vous pouvez négocier directement.' };
  if (p.contract && p.contract.buyout > 0 && fee >= p.contract.buyout) return { status: 'accepted', message: `Clause libératoire (${money(p.contract.buyout)}) activée : ${seller.name} ne peut pas refuser.` };
  if (!transferWindowOpen(g)) return { status: 'rejected', message: 'Le mercato est fermé : seuls les agents libres ou les clauses libératoires sont possibles.' };
  let ask = askingFee(g, p);
  if (seller.balance < 0) ask *= 0.8; // a club in trouble sells cheaper
  if (starters(g, seller.id).length <= 3 && p.squadRole === 'starter') ask *= 1.15;
  if (buyer.region === seller.region && seller.reputation > buyer.reputation + 20) ask *= 1.1;
  ask = Math.round(ask / 500) * 500;
  if (fee >= ask) return { status: 'accepted', message: `${seller.name} accepte votre offre de ${money(fee)}.` };
  if (fee >= ask * 0.72) return { status: 'counter', counterFee: ask, message: `${seller.name} réclame ${money(ask)}.` };
  return { status: 'rejected', message: `${seller.name} juge l'offre irrespectueuse (attente ≈ ${money(ask)}).` };
}

export function makeOffer(g: GameState, pid: string, fee: number): OfferResponse {
  const p = g.players[pid], buyer = g.orgs[g.userOrgId!];
  if (fee > buyer.balance + 0) return { status: 'rejected', message: 'Fonds insuffisants pour couvrir cette indemnité.' };
  const r = clubResponse(g, p, buyer, fee);
  const o: TransferOffer = { id: newId(g, 'x'), date: g.date, playerId: pid, fromOrgId: buyer.id, toOrgId: p.orgId, fee, status: r.status === 'accepted' ? 'accepted' : r.status === 'counter' ? 'pending' : 'rejected', counterFee: r.counterFee, incoming: false, expires: addDays(g.date, 7) };
  g.offers[o.id] = o;
  if (r.status === 'accepted') openNegotiation(g, pid, fee, false);
  return r;
}

export function openNegotiation(g: GameState, pid: string, fee: number, renewal: boolean) {
  const p = g.players[pid], org = g.orgs[g.userOrgId!];
  const role: SquadRole = renewal ? (p.squadRole ?? 'starter') : 'starter';
  const demand = demandedTerms(g, p, org, role);
  const { score } = interestIn(g, p, org, role);
  g.negotiation = { playerId: pid, orgId: org.id, fee, patience: clamp(Math.round(3 + score), 1, 5), lastDemand: demand, mood: moodText(score), renewal };
}

function moodText(score: number) {
  return score > 2 ? 'Très enthousiaste' : score > 0.8 ? 'Intéressé' : score > -0.5 ? 'Hésitant' : score > -1.5 ? 'Réticent' : 'Peu intéressé';
}

export interface TermsResponse { status: 'accepted' | 'counter' | 'walkaway'; message: string; demand?: ContractTerms }

export function proposeTerms(g: GameState, offer: ContractTerms): TermsResponse {
  const n = g.negotiation;
  if (!n) return { status: 'walkaway', message: 'Aucune négociation en cours.' };
  const p = g.players[n.playerId], org = g.orgs[n.orgId];
  const fresh = demandedTerms(g, p, org, offer.role);
  // the agent's current position (concessions made in earlier rounds are kept)
  const pref = offer.role === n.lastDemand.role ? n.lastDemand : fresh;
  const { score, reasons } = interestIn(g, p, org, offer.role);
  if (score < -2.6) { g.negotiation = null; return { status: 'walkaway', message: `${p.tag} ne souhaite pas rejoindre ${org.name}. ${reasons.join(' · ')}` }; }
  const totalCost = offer.signingBonus + n.fee;
  if (totalCost > org.balance) return { status: 'counter', message: `Fonds insuffisants : indemnité + prime à la signature = ${money(totalCost)}.`, demand: n.lastDemand };
  const ratio = termsValue(offer, pref) / termsValue(pref, pref);
  if (ratio >= 0.985) {
    completeSigning(g, p, org, offer, n.fee);
    g.negotiation = null;
    return { status: 'accepted', message: `${p.tag} accepte ! ${n.renewal ? 'Contrat prolongé' : 'Transfert bouclé'}.` };
  }
  n.patience -= ratio < 0.8 ? 2 : 1;
  if (n.patience <= 0) {
    g.negotiation = null;
    p.cond.morale = clamp(p.cond.morale - (n.renewal ? 8 : 0), 0, 100);
    if (n.renewal) p.unhappy = (p.unhappy ?? 0) + 30;
    return { status: 'walkaway', message: `${p.tag} met fin aux discussions. ${reasons[0] ?? ''}` };
  }
  // meet halfway on salary
  const conceded = Math.max(fresh.salary * 0.9, pref.salary * 0.97, Math.min(pref.salary, offer.salary));
  const newDemand = { ...pref, salary: Math.round(conceded / 50) * 50 };
  n.lastDemand = newDemand;
  n.mood = moodText(score);
  return { status: 'counter', message: `${p.tag} demande mieux (${Math.round(ratio * 100)}% de ses attentes). Patience restante : ${n.patience}.`, demand: newDemand };
}

export function completeSigning(g: GameState, p: Player, org: Org, t: ContractTerms, fee: number) {
  const from = p.orgId ? g.orgs[p.orgId] : null;
  const renewal = from?.id === org.id;
  if (!renewal) {
    if (fee > 0 && from) {
      book(g, org.id, 'Transferts (achats)', -fee, `Transfert de ${p.tag} (${from.tag})`);
      book(g, from.id, 'Transferts (ventes)', fee, `Vente de ${p.tag} à ${org.tag}`);
    }
    joinOrg(g, p, org, t.role);
    g.transfersLog.unshift({ date: g.date, playerId: p.id, tag: p.tag, from: from?.name ?? 'Agent libre', to: org.name, fee });
    if (g.transfersLog.length > 500) g.transfersLog.length = 500;
    if (fee > 0 && (!g.records.transferFee || fee > g.records.transferFee.value)) {
      g.records.transferFee = { value: fee, label: `${p.tag} : ${from?.name} → ${org.name}`, date: g.date };
      addNews(g, { kind: 'transfer', title: `Record ! ${p.tag} devient le transfert le plus cher de l'histoire`, body: `${org.name} débourse ${money(fee)} pour arracher ${p.tag} à ${from?.name}.`, orgIds: [org.id], playerIds: [p.id], important: true });
    }
    const big = ca(p) > 78 || fee > 60000 || org.isUser || from?.isUser;
    if (big) addNews(g, { kind: 'transfer', title: fee > 0 ? `${p.tag} rejoint ${org.name} (${money(fee)})` : `${org.name} signe ${p.tag}`, body: fee > 0 ? `Après d'intenses négociations, ${org.name} officialise l'arrivée de ${p.tag} en provenance de ${from?.name}. Contrat de ${t.years} an(s).` : `L'agent libre ${p.tag} s'engage pour ${t.years} an(s) avec ${org.name}.`, orgIds: [org.id, ...(from ? [from.id] : [])], playerIds: [p.id], important: !!(org.isUser || from?.isUser) });
    p.cond.morale = clamp(p.cond.morale + 10, 0, 100);
    if (org.isUser) g.scout[p.id] = 100;
  }
  if (t.signingBonus) book(g, org.id, 'Primes', -t.signingBonus, `Prime à la signature — ${p.tag}`);
  p.contract = { salary: t.salary, start: g.date, end: contractEndFor(g, t.years), buyout: t.buyout, signingBonus: t.signingBonus, winBonus: t.winBonus, prizeShare: t.prizeShare };
  p.squadRole = t.role;
  if (t.role === 'starter') {
    const st = starters(g, org.id);
    if (st.length > 3) { const worst = st.filter(x => x.id !== p.id).sort((a, b) => ca(a) - ca(b))[0]; worst.squadRole = 'sub'; }
  }
  p.unhappy = 0;
}

/** Mutual termination: pays 50% of remaining salary. */
export function releaseCost(g: GameState, p: Player) {
  if (!p.contract) return 0;
  const months = Math.max(0, daysBetween(g.date, p.contract.end) / 30.4);
  return Math.round(p.contract.salary * months * 0.5);
}
export function releasePlayer(g: GameState, p: Player) {
  const org = p.orgId ? g.orgs[p.orgId] : null;
  if (!org) return;
  const cost = releaseCost(g, p);
  if (cost) book(g, org.id, 'Salaires joueurs', -cost, `Indemnité de rupture — ${p.tag}`);
  leaveOrg(g, p);
  p.contract = null;
  p.cond.morale = clamp(p.cond.morale - 10, 0, 100);
  if (org.isUser || ca(p) > 75) addNews(g, { kind: 'transfer', title: `${org.name} libère ${p.tag}`, body: `${p.tag} quitte ${org.name} et devient agent libre.`, orgIds: [org.id], playerIds: [p.id], important: org.isUser });
}

// ---------------------------------------------------------------- incoming offers (AI -> user)
export function respondIncoming(g: GameState, offerId: string, accept: boolean) {
  const o = g.offers[offerId];
  if (!o || o.status !== 'pending') return 'Offre expirée.';
  const p = g.players[o.playerId], buyer = g.orgs[o.fromOrgId];
  if (!accept) {
    o.status = 'rejected';
    if (buyer.reputation > (g.orgs[g.userOrgId!]?.reputation ?? 0) + 10 && p.hidden.ambition > 13) { p.cond.morale = clamp(p.cond.morale - 12, 0, 100); p.unhappy = (p.unhappy ?? 0) + 20; return `${p.tag} est déçu que vous ayez refusé l'offre de ${buyer.name}.`; }
    return 'Offre refusée.';
  }
  if (buyer.balance < o.fee) { o.status = 'withdrawn'; return `${buyer.name} n'a plus les fonds nécessaires.`; }
  const terms = demandedTerms(g, p, buyer, 'starter');
  const { score } = interestIn(g, p, buyer, 'starter');
  if (score < -0.8 && !chance(0.3)) { o.status = 'rejected'; return `${p.tag} refuse de rejoindre ${buyer.name}.`; }
  completeSigning(g, p, buyer, terms, o.fee);
  o.status = 'completed';
  return `${p.tag} est transféré à ${buyer.name} pour ${money(o.fee)}.`;
}

// ---------------------------------------------------------------- AI market
function aiTarget(g: GameState, org: Org, minCa: number, maxFee: number): Player | null {
  const pool = Object.values(g.players).filter(p => !p.retired && p.orgId !== org.id && (p.region === org.region || (org.reputation > 70 && chance(0.15))) && ca(p) >= minCa && ageOn(p.birth, g.date) >= 16);
  const cands: { p: Player; fee: number; score: number }[] = [];
  for (const p of pool) {
    const seller = p.orgId ? g.orgs[p.orgId] : null;
    if (seller && !transferWindowOpen(g) && !(p.contract && p.contract.buyout)) continue;
    const fee = seller ? (p.contract?.buyout && p.contract.buyout < askingFee(g, p) * 1.1 ? p.contract.buyout : askingFee(g, p)) : 0;
    if (fee > maxFee) continue;
    if (seller && seller.isUser && !transferWindowOpen(g)) continue;
    const c = ca(p), a = ageOn(p.birth, g.date);
    let score = c;
    if (org.philosophy === 'Formation') score += (p.hidden.potential - c) * 0.5 - Math.max(0, a - 21) * 1.5;
    if (org.philosophy === 'Moneyball') score += -fee / 8000 + (p.orgId ? 0 : 3);
    if (org.philosophy === 'Galactique') score += c * 0.1 + p.popularity * 0.05;
    if (org.philosophy === 'Stable') score -= fee / 15000;
    score += rand() * 4;
    cands.push({ p, fee, score });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands[0]?.p ?? null;
}

export function aiTransferTick(g: GameState) {
  const open = transferWindowOpen(g);
  for (const org of shuffle(Object.values(g.orgs))) {
    if (org.isUser || org.disbanded) continue;
    const st = starters(g, org.id);
    const urgent = st.length < 3;
    if (!urgent && !chance(open ? 0.045 : 0.006)) continue;
    const budget = Math.max(0, org.balance - monthlyWageBill(g, org) * 3);
    const weakest = st.slice().sort((a, b) => ca(a) - ca(b))[0];
    const minCa = urgent ? 0 : weakest ? ca(weakest) + 3 + org.ambition / 6 : 0;
    const target = aiTarget(g, org, minCa, budget * (urgent ? 0.6 : 0.45));
    if (!target) { if (urgent) autoLineup(g, org); continue; }
    const seller = target.orgId ? g.orgs[target.orgId] : null;
    const fee = seller ? (target.contract?.buyout && target.contract.buyout <= askingFee(g, target) ? target.contract.buyout : askingFee(g, target)) : 0;
    if (seller?.isUser) {
      // offers to the user go through the inbox
      if (Object.values(g.offers).some(o => o.playerId === target.id && o.status === 'pending')) continue;
      const off: TransferOffer = { id: newId(g, 'x'), date: g.date, playerId: target.id, fromOrgId: org.id, toOrgId: seller.id, fee: Math.round(fee * (0.85 + rand() * 0.3) / 500) * 500, status: 'pending', incoming: true, expires: addDays(g.date, 6) };
      g.offers[off.id] = off;
      inbox(g, `Offre de ${org.name} pour ${target.tag}`, `${org.name} propose ${money(off.fee)} pour ${target.tag}. Répondez avant le ${off.expires}.`, { kind: 'offer', id: off.id });
      if (chance(0.5)) addNews(g, { kind: 'rumor', title: `Rumeur : ${org.name} s'intéresse à ${target.tag}`, body: `Selon nos sources, ${org.name} aurait formulé une offre pour ${target.tag}.`, orgIds: [org.id, seller.id], playerIds: [target.id], important: false });
      continue;
    }
    const role: SquadRole = 'starter';
    const { score } = interestIn(g, target, org, role);
    if (score < -0.6 && !chance(0.2)) continue;
    if (chance(0.35)) addNews(g, { kind: 'rumor', title: `Rumeur : ${target.tag} vers ${org.name} ?`, body: `${target.tag}${seller ? ` (${seller.tag})` : ''} serait dans le viseur de ${org.name}.`, orgIds: [org.id], playerIds: [target.id], important: false });
    const terms = demandedTerms(g, target, org, role);
    if (fee + terms.signingBonus > org.balance) continue;
    // wage discipline: AI must sustain the new salary for ~18 months
    const net = forecastMonth(g, org).net - terms.salary;
    if (net < 0 && org.balance - fee + net * 18 < 0 && !(urgent && terms.salary < 2500)) continue;
    completeSigning(g, target, org, terms, fee);
    // make room: demote / release
    const subs = orgPlayers(g, org.id).filter(p => p.squadRole === 'sub').sort((a, b) => ca(a) - ca(b));
    if (subs.length > 2) releasePlayer(g, subs[0]);
    if (seller && !seller.isUser && starters(g, seller.id).length < 3) autoLineup(g, seller);
    autoLineup(g, org);
  }
  // expire offers
  for (const o of Object.values(g.offers)) if (o.status === 'pending' && o.expires < g.date) o.status = 'withdrawn';
  // false rumours keep the press busy
  if (chance(0.04)) {
    const stars = Object.values(g.players).filter(p => p.orgId && ca(p) > 80);
    const orgs = Object.values(g.orgs).filter(o => !o.disbanded && o.reputation > 60);
    if (stars.length && orgs.length) {
      const p = pick(stars), o = pick(orgs);
      if (o.id !== p.orgId) addNews(g, { kind: 'rumor', title: `Rumeur : ${o.name} prêt à tout pour ${p.tag}`, body: `D'après un insider, ${o.name} envisagerait une offre record pour ${p.tag}. Une information à prendre avec des pincettes.`, orgIds: [o.id], playerIds: [p.id], important: false });
    }
  }
}

export function yearsLeftLabel(g: GameState, p: Player) { const y = yearsLeft(g, p); return y < 1 ? `${Math.round(y * 12)} mois` : `${y.toFixed(1)} an(s)`; }
