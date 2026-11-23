// ============================================================================
// Sponsorships & social media
// ============================================================================
import type { GameState, Org, Sponsor, SponsorDeal } from './types';
import { addDays, chance, clamp, gauss, money, newId, num, rand } from './util';
import { activeDeals, totalFollowers } from './finance';
import { book } from './ledger';
import { addNews, inbox } from './news';
import { starters } from './roster';
import { DIFFICULTY } from './data';

// ---------------------------------------------------------------- sponsors
export function sponsorFits(s: Sponsor, org: Org) { return s.regions === 'GLOBAL' || s.regions.includes(org.region); }

/** 0..100 interest of a brand in an org. */
export function sponsorInterest(g: GameState, s: Sponsor, org: Org): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let sc = 50;
  const repGap = org.reputation - s.minReputation;
  sc += repGap * 0.9;
  if (repGap < 0) reasons.push(`Réputation insuffisante (min. ${s.minReputation})`);
  const f = totalFollowers(org);
  const audience = Math.log10(Math.max(1000, f)) - 4; // 0 at 10k, 1 at 100k, 2 at 1M
  sc += audience * (s.audience === 'Mainstream' ? 14 : s.audience === 'Casual' ? 10 : 6);
  if (!sponsorFits(s, org)) { sc -= 40; reasons.push('Hors de ses marchés'); }
  const recent = org.trophies.filter(t => t.season >= g.season - 1).length;
  sc += recent * 5;
  if (recent) reasons.push('Séduit par les résultats récents');
  sc += (org.social.sentiment - 60) * 0.3;
  if (org.social.sentiment < 45) reasons.push('Image communautaire dégradée');
  if (s.audience === 'Hardcore' && org.elo > 1700) { sc += 6; reasons.push('Public hardcore : valorise le niveau compétitif'); }
  if (activeDeals(g, org).some(d => g.sponsors[d.sponsorId].industry === s.industry)) { sc = -1; reasons.push('Conflit : vous avez déjà un partenaire de ce secteur'); }
  if (Object.values(g.deals).some(d => d.active && d.sponsorId === s.id && d.orgId === org.id)) { sc = -1; reasons.push('Déjà partenaire'); }
  return { score: clamp(sc, -1, 100), reasons };
}

/** Max monthly amount a brand would pay. */
export function sponsorValuation(g: GameState, s: Sponsor, org: Org) {
  const { score } = sponsorInterest(g, s, org);
  if (score <= 0) return 0;
  const f = totalFollowers(org);
  const reach = clamp(Math.log10(Math.max(1000, f)) / 6, 0.4, 1.1);
  return Math.round(s.budget * (0.2 + org.reputation / 150) * reach * (score / 75) * DIFFICULTY[g.difficulty].sponsor / 50) * 50;
}

export interface SponsorProposal { monthly: number; years: number; objective: SponsorDeal['objective']['kind']; posts: number }

export function proposeSponsorDeal(g: GameState, sponsorId: string, prop: SponsorProposal): { ok: boolean; message: string; counter?: number } {
  const org = g.orgs[g.userOrgId!]; const s = g.sponsors[sponsorId];
  const { score, reasons } = sponsorInterest(g, s, org);
  if (score < 25) return { ok: false, message: `${s.name} décline : ${reasons.join(', ') || 'pas intéressé'}.` };
  if (org.sponsorIds.filter(id => g.deals[id]?.active).length >= 3 + org.facilities) return { ok: false, message: 'Plus d\'emplacement partenaire disponible (améliorez vos infrastructures).' };
  let val = sponsorValuation(g, s, org);
  val *= 1 + (prop.posts - 2) * 0.06;          // more promo obligations => more money
  val *= prop.years === 2 ? 1.05 : prop.years === 3 ? 1.08 : 1;
  val *= s.style === 'Opportuniste' ? 0.92 : 1;
  if (prop.monthly <= val) {
    signDeal(g, s, org, prop);
    return { ok: true, message: `${s.name} signe pour ${money(prop.monthly)}/mois sur ${prop.years} an(s) !` };
  }
  if (prop.monthly <= val * 1.25) return { ok: false, message: `${s.name} propose plutôt ${money(Math.floor(val / 50) * 50)}/mois.`, counter: Math.floor(val / 50) * 50 };
  return { ok: false, message: `${s.name} juge la demande déraisonnable.` };
}

function objectiveFor(g: GameState, org: Org, kind: SponsorDeal['objective']['kind'], monthly: number): SponsorDeal['objective'] {
  if (kind === 'placement') { const target = org.elo > 1750 ? 2 : org.elo > 1600 ? 4 : 8; return { kind, target, bonus: monthly * 3, label: `Finir dans le top ${target} d'un régional ou mieux` }; }
  if (kind === 'followers') { const target = Math.round(totalFollowers(org) * 1.3); return { kind, target, bonus: monthly * 2, label: `Atteindre ${num(target)} abonnés` }; }
  return { kind, target: 30, bonus: monthly * 1.5, label: 'Publier 30 contenus sponsorisés' };
}

export function signDeal(g: GameState, s: Sponsor, org: Org, prop: SponsorProposal) {
  const id = newId(g, 'd');
  const d: SponsorDeal = { id, sponsorId: s.id, orgId: org.id, monthly: prop.monthly, start: g.date, end: `${+g.date.slice(0, 4) + prop.years - 1}-12-31`, objective: objectiveFor(g, org, prop.objective, prop.monthly), objectiveMet: false, postsRequired: prop.posts, postsDone: 0, satisfaction: 70, active: true };
  g.deals[id] = d;
  org.sponsorIds.push(id);
  addNews(g, { kind: 'sponsor', title: `${org.name} s'associe à ${s.name}`, body: `${s.name} (${s.industry}) devient partenaire officiel de ${org.name}.`, orgIds: [org.id], playerIds: [], important: org.isUser });
  org.social.sentiment = clamp(org.social.sentiment + 2, 0, 100);
}

export function terminateDeal(g: GameState, dealId: string) {
  const d = g.deals[dealId]; if (!d) return;
  d.active = false;
  const org = g.orgs[d.orgId];
  book(g, org.id, 'Sponsors', -d.monthly * 2, `Rupture anticipée — ${g.sponsors[d.sponsorId].name}`);
}

/** Monthly: obligations, satisfaction, objectives, expiry. */
export function sponsorMonthly(g: GameState) {
  for (const d of Object.values(g.deals)) {
    if (!d.active) continue;
    const org = g.orgs[d.orgId]; const s = g.sponsors[d.sponsorId];
    if (!org || org.disbanded) { d.active = false; continue; }
    if (org.isUser) {
      const missing = Math.max(0, d.postsRequired - d.postsDone);
      d.satisfaction = clamp(d.satisfaction + (missing ? -missing * (s.style === 'Exigeant' ? 9 : 5) : 4) + (org.social.sentiment - 60) / 15, 0, 100);
      d.postsDone = 0;
      if (d.satisfaction < 20) {
        d.active = false;
        inbox(g, `${s.name} rompt le partenariat`, `Obligations promotionnelles non respectées. Le contrat de ${money(d.monthly)}/mois prend fin.`);
        addNews(g, { kind: 'sponsor', title: `${s.name} quitte ${org.name}`, body: `Le sponsor met fin au partenariat de manière anticipée.`, orgIds: [org.id], playerIds: [], important: true });
        continue;
      }
      if (d.satisfaction < 40) inbox(g, `${s.name} est mécontent`, `Satisfaction ${Math.round(d.satisfaction)}%. Publiez les contenus sponsorisés prévus (${d.postsRequired}/mois).`);
      if (!d.objectiveMet && d.objective.kind === 'followers' && totalFollowers(org) >= d.objective.target) completeObjective(g, d);
    }
    if (d.end < g.date) {
      d.active = false;
      if (org.isUser) inbox(g, `Fin du contrat ${s.name}`, `Le partenariat est arrivé à échéance. Vous pouvez le renégocier depuis l'écran Sponsors.`, { kind: 'screen', id: 'sponsors' });
      else if (chance(0.7)) { // AI renew
        const nd = { ...d, id: newId(g, 'd'), start: g.date, end: `${+g.date.slice(0, 4) + 1}-12-31`, active: true, monthly: Math.round(d.monthly * (0.9 + org.reputation / 300)) };
        g.deals[nd.id] = nd; org.sponsorIds.push(nd.id);
      }
    }
  }
}

/** AI orgs pursue new partners when they have free slots. */
export function aiSponsorAcquisition(g: GameState) {
  for (const org of Object.values(g.orgs)) {
    if (org.isUser || org.disbanded) continue;
    const n = activeDeals(g, org).length;
    if (n >= Math.min(5, 1 + Math.floor(org.reputation / 22)) || !chance(0.5)) continue;
    const cands = Object.values(g.sponsors).map(s => ({ s, v: sponsorValuation(g, s, org) })).filter(x => x.v > 0 && sponsorInterest(g, x.s, org).score >= 30).sort((a, b) => b.v - a.v);
    if (!cands.length) continue;
    const { s, v } = cands[Math.floor(rand() * Math.min(3, cands.length))];
    signDeal(g, s, org, { monthly: Math.round(v * 0.9 / 50) * 50, years: 1 + Math.floor(rand() * 2), objective: 'placement', posts: 2 });
  }
}

export function completeObjective(g: GameState, d: SponsorDeal) {
  if (d.objectiveMet) return;
  d.objectiveMet = true; d.satisfaction = clamp(d.satisfaction + 20, 0, 100);
  book(g, d.orgId, 'Sponsors', d.objective.bonus, `Bonus objectif — ${g.sponsors[d.sponsorId].name}`);
  inbox(g, `Objectif sponsor atteint : ${g.sponsors[d.sponsorId].name}`, `${d.objective.label} — bonus de ${money(d.objective.bonus)} versé.`);
}

/** After a tournament: check placement objectives. */
export function checkPlacementObjectives(g: GameState, orgId: string, rank: number) {
  for (const d of Object.values(g.deals)) if (d.active && d.orgId === orgId && d.objective.kind === 'placement' && !d.objectiveMet && rank <= d.objective.target) completeObjective(g, d);
}

// ---------------------------------------------------------------- social media
export type CampaignKind = 'Annonce roster' | 'Post matchday' | 'Célébration victoire' | 'Contenu sponsorisé' | 'Giveaway' | 'Vlog coulisses' | 'Campagne TikTok' | 'Stream communautaire';
export const CAMPAIGNS: Record<CampaignKind, { cost: number; reach: number; sentiment: number; desc: string; sponsor?: boolean; cooldown: number }> = {
  'Annonce roster': { cost: 500, reach: 1.0, sentiment: 2, desc: 'Présente le roster actuel. Plus efficace avec des joueurs populaires.', cooldown: 14 },
  'Post matchday': { cost: 0, reach: 0.4, sentiment: 1, desc: 'Hype avant un match. Gratuit, efficace les jours de match.', cooldown: 1 },
  'Célébration victoire': { cost: 0, reach: 0.8, sentiment: 3, desc: 'Capitalise sur une victoire récente (7 jours).', cooldown: 3 },
  'Contenu sponsorisé': { cost: 300, reach: 0.5, sentiment: -1, desc: 'Remplit une obligation partenaire pour chaque sponsor actif.', sponsor: true, cooldown: 2 },
  'Giveaway': { cost: 3000, reach: 2.0, sentiment: 6, desc: 'Grosse croissance d\'abonnés et de sentiment, coûteux.', cooldown: 21 },
  'Vlog coulisses': { cost: 2500, reach: 1.4, sentiment: 4, desc: 'Fidélise la communauté YouTube, meilleure qualité avec infrastructures.', cooldown: 10 },
  'Campagne TikTok': { cost: 1800, reach: 1.8, sentiment: 1, desc: 'Viralité forte mais volatile.', cooldown: 7 },
  'Stream communautaire': { cost: 400, reach: 0.9, sentiment: 3, desc: 'Les joueurs streament avec les fans. Fatigue légère.', cooldown: 5 },
};

export function runCampaign(g: GameState, kind: CampaignKind, lastUsed: Record<string, string>): string {
  const org = g.orgs[g.userOrgId!];
  const c = CAMPAIGNS[kind];
  if (lastUsed[kind] && addDays(lastUsed[kind], c.cooldown) > g.date) return `Disponible à nouveau le ${addDays(lastUsed[kind], c.cooldown)}.`;
  if (org.balance < c.cost) return 'Budget insuffisant.';
  if (kind === 'Célébration victoire') {
    const recentWin = Object.values(g.matches).some(m => m.played && m.winner === org.id && m.date >= addDays(g.date, -7));
    if (!recentWin) return 'Aucune victoire récente à célébrer.';
  }
  if (c.cost) book(g, org.id, 'Marketing', -c.cost, `Campagne : ${kind}`);
  const st = starters(g, org.id);
  const star = st.length ? Math.max(...st.map(p => p.popularity)) : 20;
  const quality = 0.7 + org.facilities * 0.08 + star / 200 + org.marketingBudget / 20000;
  const fatigue = 1 / (1 + org.social.postsThisMonth * 0.08);
  const base = (totalFollowers(org) * 0.006 + 150) * c.reach * quality * fatigue * (0.8 + rand() * 0.5);
  const s = org.social;
  const gains = { x: base * 0.3, tiktok: base * (kind === 'Campagne TikTok' ? 0.9 : 0.3), youtube: base * (kind === 'Vlog coulisses' ? 0.6 : 0.15), twitch: base * (kind === 'Stream communautaire' ? 0.6 : 0.12), discord: base * 0.1 };
  s.x += gains.x; s.tiktok += gains.tiktok; s.youtube += gains.youtube; s.twitch += gains.twitch; s.discord += gains.discord;
  s.sentiment = clamp(s.sentiment + c.sentiment * fatigue, 0, 100);
  s.engagement = clamp(s.engagement + 6 * c.reach * fatigue, 0, 100);
  s.postsThisMonth++;
  org.fans += Math.round(base * 0.05);
  if (c.sponsor) for (const d of activeDeals(g, org)) d.postsDone++;
  if (kind === 'Stream communautaire') for (const p of st) p.cond.fatigue = clamp(p.cond.fatigue + 3, 0, 100);
  if (kind === 'Annonce roster') for (const p of st) p.popularity = clamp(p.popularity + 0.5, 0, 100);
  lastUsed[kind] = g.date;
  return `+${num(Object.values(gains).reduce((a, b) => a + b, 0))} abonnés · sentiment ${c.sentiment >= 0 ? '+' : ''}${Math.round(c.sentiment * fatigue)}`;
}

export const fanTarget = (org: Org) => Math.exp(org.reputation / 13) * 120;

/** Daily organic growth for all orgs. */
export function socialTick(g: GameState) {
  for (const org of Object.values(g.orgs)) {
    if (org.disbanded) continue;
    const s = org.social;
    const st = starters(g, org.id);
    const pop = st.length ? st.reduce((a, p) => a + p.popularity, 0) / st.length : 20;
    // audiences converge towards a ceiling driven by reputation, star power and marketing
    const target = fanTarget(org) * 9 * (0.8 + pop / 250) * (1 + org.marketingBudget / 40000);
    const total = totalFollowers(org);
    const growth = (total < target ? 0.0025 * (1 - total / target) : -0.0012 * (1 - target / total)) + (s.sentiment - 55) / 80000 + gauss(0, 0.0002);
    s.x *= 1 + growth; s.tiktok *= 1 + growth * 1.2; s.youtube *= 1 + growth * 0.8; s.twitch *= 1 + growth * 0.7; s.discord *= 1 + growth * 0.6;
    s.engagement = clamp(s.engagement * 0.985 + (org.isUser ? 0 : 0.6), 0, 100);
    s.sentiment = clamp(s.sentiment + (60 - s.sentiment) * 0.01, 0, 100);
    org.fans = Math.max(100, Math.round(org.fans + (fanTarget(org) * (0.8 + s.sentiment / 250) - org.fans) * 0.004));
    // reputation follows sustained competitive level (Elo)
    const repTarget = clamp((org.elo - 1280) / 9.5, 3, 97);
    org.reputation = clamp(org.reputation + (repTarget - org.reputation) * 0.004, 1, 99);
    if (g.date.endsWith('-01')) { s.history.push({ date: g.date, total: totalFollowers(org) }); if (s.history.length > 60) s.history.shift(); s.postsThisMonth = 0; }
  }
}
