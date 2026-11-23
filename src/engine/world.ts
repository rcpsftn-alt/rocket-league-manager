// ============================================================================
// World generation & career creation
// ============================================================================
import type { Difficulty, GameState, Org, Player, Region, Social, StaffRole } from './types';
import { REGIONS, STAFF_ROLES } from './types';
import { DIFFICULTY, NATIONS, ORG_COLORS, ORG_PREFIX, ORG_SUFFIX, ORG_WORDS, REGION_INFO, SPONSOR_SEED } from './data';
import { clamp, gauss, newId, pick, rand, randInt, rngGet, rngSet, shuffle } from './util';
import { ca, defaultContract, generatePlayer, marketValue } from './player';
import { autoLineup, joinOrg } from './roster';
import { generateStaff, touchStaff } from './staff';
import { touchPlayers } from './roster';
import { DEFAULT_TACTIC } from './matchsim';
import { createSeasonCalendar } from './competitions';
import { addNews } from './news';
import { applyDatabase, type DbFile } from './moddb';

export { DIFFICULTY };

export function emptySocial(scale: number): Social {
  const s = Math.max(500, scale);
  return { x: Math.round(s), tiktok: Math.round(s * (0.6 + rand() * 0.8)), youtube: Math.round(s * 0.35), twitch: Math.round(s * 0.25), discord: Math.round(s * 0.12), sentiment: 60, engagement: 40, postsThisMonth: 0, history: [] };
}

export function makeOrgName(used: Set<string>): { name: string; tag: string } {
  for (let i = 0; i < 200; i++) {
    const w = pick(ORG_WORDS);
    const pre = pick(ORG_PREFIX), suf = pick(ORG_SUFFIX);
    const name = [pre, w, suf].filter(Boolean).join(' ');
    if (used.has(w)) continue;
    used.add(w);
    const tag = (w.length <= 4 ? w : w.replace(/[aeiouy]/gi, '').slice(0, 3) || w.slice(0, 3)).toUpperCase().slice(0, 4);
    return { name, tag };
  }
  const n = `Squad ${randInt(100, 999)}`; return { name: n, tag: n.slice(-3) };
}

export function createOrg(g: GameState, region: Region, tier: number, used: Set<string>, override?: Partial<Org>): Org {
  const { name, tag } = makeOrgName(used);
  const nation = pick(NATIONS[region]);
  const rep = clamp(tier * 18 + gauss(0, 6) + REGION_INFO[region].strength * 10 - 8, 3, 95);
  const fans = Math.round(Math.exp(rep / 13) * 120);
  const org: Org = {
    id: newId(g, 'o'), name, tag, region, country: nation.code, hq: pick(nation.cities), colors: pick(ORG_COLORS),
    founded: g.season - randInt(0, 9), reputation: rep, fans,
    balance: Math.round((40000 + Math.exp(rep / 14) * 3500) * (0.7 + rand() * 0.7)), debt: 0, isUser: false,
    philosophy: pick(['Moneyball', 'Galactique', 'Formation', 'Stable', 'Agressif'] as const), ambition: randInt(5, 20),
    facilities: clamp(Math.round(tier + gauss(0, 0.7)), 1, 5), academyLevel: clamp(Math.round(tier * 0.8 + gauss(0, 0.8)), 1, 5),
    tactic: { ...DEFAULT_TACTIC, pressure: randInt(-1, 1), tempo: randInt(-1, 1) }, positions: {}, captainId: null, chemistry: {},
    social: emptySocial(fans * 4), elo: Math.round(1300 + rep * 6 + gauss(0, 30)), sponsorIds: [], trophies: [],
    boardConfidence: 70, objective: '', disbanded: false, negativeMonths: 0,
    trainingFocus: { focus: 'Équilibré', intensity: 2 }, individualTraining: {}, marketingBudget: Math.round(rep * 25), bootcampUntil: null,
    ...override,
  };
  g.orgs[org.id] = org;
  return org;
}

/** Seed an org with a coherent roster around its tier. */
function fillRoster(g: GameState, org: Org, tier: number, tags: Set<string>) {
  const base = 50 + tier * 6.2 + (REGION_INFO[org.region].strength - 0.9) * 40;
  for (let i = 0; i < 3; i++) {
    const a = randInt(17, 27);
    const p = generatePlayer(g, { region: org.region, ca: clamp(base + gauss(0, 4.2), 35, 93), age: a, tags });
    g.players[p.id] = p;
    joinOrg(g, p, org, 'starter');
    defaultContract(g, p, org.reputation);
    p.joinedOrgDate = `${g.season - randInt(0, 2)}-0${randInt(1, 9)}-01`;
  }
  if (rand() < 0.35 + tier * 0.08) {
    const p = generatePlayer(g, { region: org.region, ca: clamp(base - 5 + gauss(0, 4), 35, 85), age: randInt(16, 24), tags });
    g.players[p.id] = p; joinOrg(g, p, org, 'sub'); defaultContract(g, p, org.reputation);
  }
  if (rand() < 0.2 + org.academyLevel * 0.08) {
    const p = generatePlayer(g, { region: org.region, ca: clamp(base - 12 + gauss(0, 4), 30, 75), age: randInt(15, 18), tags, archetype: rand() < 0.4 ? 'Prospect élite' : undefined });
    g.players[p.id] = p; joinOrg(g, p, org, 'academy'); defaultContract(g, p, org.reputation);
    p.contract!.salary = Math.round(p.contract!.salary * 0.5);
  }
  autoLineup(g, org);
  // initial chemistry: teams that have been together a while
  for (const k of Object.keys(org.chemistry)) delete org.chemistry[k];
}

function hireInitialStaff(g: GameState, org: Org, tier: number) {
  const roles: StaffRole[] = ['Head coach'];
  if (tier >= 3) roles.push('Analyste');
  if (tier >= 4) roles.push('Assistant coach', 'Performance coach');
  if (tier >= 5) roles.push('Mental coach');
  for (const r of roles) {
    const s = generateStaff(g, org.region, r, clamp(tier * 3 + randInt(0, 4), 3, 19));
    s.orgId = org.id; s.contractEnd = `${g.season + randInt(0, 2)}-12-31`;
    g.staff[s.id] = s;
  }
  touchStaff();
}

export interface NewCareerOpts {
  saveName: string;
  managerName: string;
  managerNationality: string;
  difficulty: Difficulty;
  season: number;
  mode: 'create' | 'takeover' | 'unemployed';
  create?: { name: string; tag: string; region: Region; country: string; hq: string; colors: [string, string]; budget: number; reputation: number; ambition: 'Survivre' | 'Progresser' | 'Dominer' };
  takeoverOrgId?: string;
  seed?: number;
  db?: DbFile;
}

/** Generates the persistent world (orgs, players, staff, sponsors, calendar). */
export function generateWorld(seed: number, season: number, difficulty: Difficulty): GameState {
  rngSet(seed);
  const g: GameState = {
    version: 1, saveId: '', saveName: '', createdAt: new Date().toISOString(), seed, rngState: seed,
    date: `${season}-01-02`, season, difficulty,
    manager: { name: '', nationality: 'FR', reputation: 20, experience: 0, orgId: null, trophies: [], history: [], applications: [], hiredDate: null },
    userOrgId: null, players: {}, orgs: {}, staff: {}, sponsors: {}, deals: {}, tournaments: {}, matches: {}, news: [], offers: {},
    negotiation: null, ledger: [], monthly: [], circuitPoints: {}, splitPoints: {}, transfersLog: [], history: [],
    records: { transferFee: null, seriesGoals: null, gameScore: null, biggestPrize: null }, scout: {}, shortlist: [],
    pendingUserMatch: null, inbox: [], idCounter: 0, gameOver: false, settings: { autosave: true, liveSpeed: 2 }, eloHistory: {}, campaignsUsed: {}, rankingHistory: [],
  };
  const tags = new Set<string>();
  const used = new Set<string>();
  for (const r of REGIONS) {
    const n = REGION_INFO[r].teams;
    // tier distribution: few elite, many mid
    const tiers = shuffle(Array.from({ length: n }, (_, i) => clamp(5 - Math.floor(i / (n / 5)) + (rand() < 0.2 ? -1 : 0), 1, 5)));
    for (let i = 0; i < n; i++) {
      const tier = tiers[i];
      const org = createOrg(g, r, tier, used);
      fillRoster(g, org, tier, tags);
      hireInitialStaff(g, org, tier);
    }
    // free agents & prospects
    const faCount = r === 'EU' || r === 'NA' ? 34 : 22;
    for (let i = 0; i < faCount; i++) {
      const a = randInt(16, 30);
      const p = generatePlayer(g, { region: r, ca: clamp(48 + gauss(0, 8) + (REGION_INFO[r].strength - 0.9) * 30, 30, 82), age: a, tags, archetype: rand() < 0.15 ? 'Agent libre sous-coté' : undefined });
      g.players[p.id] = p;
    }
    for (let i = 0; i < 6; i++) {
      const p = generatePlayer(g, { region: r, ca: 42 + rand() * 12, age: randInt(15, 17), tags, archetype: pick(['Prospect élite', 'Talent régional', 'Prodige mécanique'] as const) });
      g.players[p.id] = p;
    }
    // free staff pool
    for (const role of STAFF_ROLES) for (let i = 0; i < 3; i++) { const s = generateStaff(g, r, role, randInt(3, 16)); g.staff[s.id] = s; }
  }
  // sponsors
  for (const s of SPONSOR_SEED) {
    const id = newId(g, 'sp');
    g.sponsors[id] = {
      id, name: s.name, industry: s.industry, reputation: s.tier * 18 + randInt(-5, 5), budget: s.tier * s.tier * 1000 + randInt(0, 1200),
      regions: s.regions, minReputation: Math.max(0, s.tier * 16 - 20), audience: s.audience, style: pick(['Exigeant', 'Patient', 'Opportuniste'] as const),
    };
  }
  // AI orgs start with some sponsors
  for (const o of Object.values(g.orgs)) {
    const n = Math.min(5, 1 + Math.floor(o.reputation / 22));
    const pool = shuffle(Object.values(g.sponsors).filter(s => s.minReputation <= o.reputation && (s.regions === 'GLOBAL' || s.regions.includes(o.region))));
    const usedInd = new Set<string>();
    for (const s of pool) {
      if (o.sponsorIds.length >= n) break;
      if (usedInd.has(s.industry)) continue;
      usedInd.add(s.industry);
      const did = newId(g, 'd');
      g.deals[did] = { id: did, sponsorId: s.id, orgId: o.id, monthly: Math.round(s.budget * (0.45 + o.reputation / 150) / 100) * 100, start: `${season - 1}-06-01`, end: `${season + randInt(0, 1)}-12-31`, objective: { kind: 'placement', target: 8, bonus: 0, label: '—' }, objectiveMet: false, postsRequired: 2, postsDone: 0, satisfaction: 70, active: true };
      o.sponsorIds.push(did);
    }
  }
  createSeasonCalendar(g, season);
  for (const p of Object.values(g.players)) p.value = marketValue(g, p);
  g.rngState = rngGet();
  return g;
}

export function startCareer(o: NewCareerOpts): GameState {
  const seed = o.seed ?? Math.floor(Math.random() * 2 ** 31);
  const g = generateWorld(seed, o.season, o.difficulty);
  if (o.db) applyDatabase(g, o.db);
  g.saveId = `save_${Date.now().toString(36)}`;
  g.saveName = o.saveName || o.managerName;
  g.manager.name = o.managerName;
  g.manager.nationality = o.managerNationality;
  const D = DIFFICULTY[o.difficulty];
  if (o.mode === 'create' && o.create) {
    const c = o.create;
    // the new org takes the circuit slot of the weakest org of its region, which disbands
    const victim = Object.values(g.orgs).filter(x => x.region === c.region && !x.disbanded).sort((a, b) => a.reputation - b.reputation)[0];
    disbandOrg(g, victim, `${victim.name} cède sa place sur le circuit à une nouvelle structure.`);
    const used = new Set<string>();
    const org = createOrg(g, c.region, 1, used, {
      name: c.name, tag: c.tag.toUpperCase().slice(0, 4), country: c.country, hq: c.hq, colors: c.colors,
      reputation: c.reputation, fans: Math.round(Math.exp(c.reputation / 13) * 80), balance: Math.round(c.budget * D.budget), isUser: true,
      founded: o.season, facilities: 1, academyLevel: 1, elo: 1350 + c.reputation * 3, philosophy: 'Formation', ambition: 12,
    });
    org.social = emptySocial(1500 + c.reputation * 80);
    org.objective = c.ambition === 'Survivre' ? 'Rester solvable et atteindre les playoffs d\'un régional' : c.ambition === 'Progresser' ? 'Se qualifier pour un Major' : 'Remporter un Major';
    // starter roster: three hungry free agents
    const fa = Object.values(g.players).filter(p => !p.orgId && p.region === c.region && ca(p) < 64).sort((a, b) => ca(b) - ca(a)).slice(0, 3);
    for (const p of fa) {
      joinOrg(g, p, org, 'starter'); defaultContract(g, p, org.reputation);
      p.contract!.end = `${o.season}-12-31`; p.contract!.start = g.date;
    }
    const coach = generateStaff(g, c.region, 'Head coach', 7); coach.orgId = org.id; coach.contractEnd = `${o.season}-12-31`; g.staff[coach.id] = coach; touchStaff();
    g.userOrgId = org.id;
    g.manager.orgId = org.id; g.manager.hiredDate = g.date; g.manager.reputation = 15; g.manager.founderOrgId = org.id;
    addNews(g, { kind: 'club', title: `${org.name} fait son entrée sur la scène ${REGION_INFO[c.region].name}`, body: `Nouvelle structure basée à ${c.hq}, ${org.name} (${org.tag}) annonce ses ambitions et confie les clés à ${o.managerName}.`, orgIds: [org.id], playerIds: [], important: true });
  } else if (o.mode === 'takeover' && o.takeoverOrgId) {
    const org = g.orgs[o.takeoverOrgId];
    takeControl(g, org);
    org.balance = Math.round(org.balance * D.budget);
    g.manager.reputation = clamp(org.reputation * 0.5, 15, 60);
  } else {
    g.manager.reputation = 12;
    addNews(g, { kind: 'club', title: `${o.managerName} sur le marché des managers`, body: `Sans club, ${o.managerName} cherche un premier poste sur la scène Rocket League.`, orgIds: [], playerIds: [], important: true });
  }
  g.rngState = rngGet();
  return g;
}

export function takeControl(g: GameState, org: Org) {
  for (const o of Object.values(g.orgs)) o.isUser = false;
  org.isUser = true;
  g.userOrgId = org.id;
  g.manager.orgId = org.id;
  g.manager.hiredDate = g.date;
  org.boardConfidence = 65;
  org.objective = boardObjective(g, org);
  for (const p of Object.values(g.players)) if (p.orgId === org.id) g.scout[p.id] = 100;
  addNews(g, { kind: 'club', title: `${org.name} nomme ${g.manager.name} manager`, body: `Le board de ${org.name} confie la gestion sportive et commerciale à ${g.manager.name}. Objectif fixé : ${org.objective}.`, orgIds: [org.id], playerIds: [], important: true });
}

export function boardObjective(g: GameState, org: Org): string {
  const rank = Object.values(g.orgs).filter(o => o.region === org.region && !o.disbanded).sort((a, b) => b.elo - a.elo).findIndex(o => o.id === org.id) + 1;
  if (rank <= 2) return 'Remporter un Major';
  if (rank <= 5) return 'Se qualifier pour un Major';
  if (rank <= 9) return 'Atteindre régulièrement les playoffs régionaux';
  return 'Rester solvable et atteindre les playoffs d\'un régional';
}

export function disbandOrg(g: GameState, org: Org, reason: string) {
  org.disbanded = true;
  for (const p of Object.values(g.players)) if (p.orgId === org.id) { p.orgId = null; p.squadRole = null; p.contract = null; p.joinedOrgDate = null; }
  for (const s of Object.values(g.staff)) if (s.orgId === org.id) { s.orgId = null; s.contractEnd = null; }
  touchStaff(); touchPlayers();
  for (const d of Object.values(g.deals)) if (d.orgId === org.id) d.active = false;
  addNews(g, { kind: 'finance', title: `${org.name} cesse ses activités`, body: reason + ' Tous les joueurs deviennent agents libres.', orgIds: [org.id], playerIds: [], important: true });
}
