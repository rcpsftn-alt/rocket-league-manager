// ============================================================================
// CSV import: spreadsheets (Excel / Google Sheets) -> rlm-db, with automatic
// level estimation from team tier + individual rating.
//
// Players CSV columns (French or English headers, any order, ; or , separated):
//   pseudo* | prenom | nom | nationalite | naissance | equipe | role | poste | style
//   niveau | potentiel | palier | rating
// Organisations CSV columns:
//   nom* | tag | region* | pays | ville | couleur1 | couleur2 | palier | ancien_nom
// ============================================================================
import type { Playstyle, Position, Region } from './types';
import { PLAYSTYLES, REGIONS } from './types';
import { NATION_BY_CODE } from './data';
import type { DbFile, DbOrg, DbPlayer } from './moddb';

// ---------------------------------------------------------------- parsing
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : (firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows.map(r => r.map(x => x.trim()));
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const ALIASES: Record<string, string[]> = {
  tag: ['pseudo', 'tag', 'gamertag', 'joueur', 'player', 'ign'],
  firstName: ['prenom', 'firstname', 'first'],
  lastName: ['nom', 'lastname', 'last', 'surname'],
  nationality: ['nationalite', 'nationality', 'nat', 'pays', 'country'],
  birthYear: ['naissance', 'anneenaissance', 'annee', 'birthyear', 'born', 'birth'],
  org: ['equipe', 'organisation', 'org', 'team', 'club'],
  role: ['role', 'statut', 'status'],
  position: ['poste', 'position', 'pos'],
  playstyle: ['style', 'playstyle'],
  level: ['niveau', 'level', 'ovr', 'note'],
  potential: ['potentiel', 'potential', 'pot'],
  tier: ['palier', 'tier'],
  rating: ['rating', 'score', 'perf'],
  // orgs
  name: ['nom', 'name', 'organisation', 'equipe', 'team'],
  region: ['region'],
  country: ['pays', 'country'],
  hq: ['ville', 'siege', 'hq', 'city'],
  color1: ['couleur1', 'color1', 'couleur', 'color', 'couleurprincipale'],
  color2: ['couleur2', 'color2', 'couleurfond', 'background'],
  from: ['anciennom', 'from', 'remplace'],
};

function headerMap(header: string[], keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const h = header.map(norm);
  for (const k of keys) {
    const idx = h.findIndex(x => ALIASES[k].includes(x));
    if (idx >= 0) out[k] = idx;
  }
  return out;
}

export type CsvKind = 'players' | 'orgs' | 'unknown';
export function detectKind(rows: string[][]): CsvKind {
  if (!rows.length) return 'unknown';
  const h = rows[0].map(norm);
  const playerKey = h.some(x => ['pseudo', 'gamertag', 'ign', 'player', 'joueur'].includes(x));
  if (h.includes('region') && !playerKey) return 'orgs';
  if (playerKey || h.includes('tag')) return 'players';
  return 'unknown';
}

// ---------------------------------------------------------------- value parsing
const COUNTRY_NAMES: Record<string, string> = {};
for (const [code, n] of Object.entries(NATION_BY_CODE)) { COUNTRY_NAMES[norm(n.name)] = code; COUNTRY_NAMES[norm(code)] = code; }
Object.assign(COUNTRY_NAMES, {
  france: 'FR', unitedkingdom: 'GB', uk: 'GB', england: 'GB', angleterre: 'GB', scotland: 'GB', ecosse: 'GB', wales: 'GB', germany: 'DE', spain: 'ES', netherlands: 'NL', holland: 'NL',
  denmark: 'DK', poland: 'PL', belgium: 'BE', sweden: 'SE', usa: 'US', unitedstates: 'US', us: 'US', etatsunis: 'US', mexico: 'MX', brazil: 'BR', argentina: 'AR', chile: 'CL',
  saudiarabia: 'SA', ksa: 'SA', morocco: 'MA', uae: 'AE', egypt: 'EG', australia: 'AU', newzealand: 'NZ', japan: 'JP', southkorea: 'KR', korea: 'KR', singapore: 'SG', thailand: 'TH',
  southafrica: 'ZA', nigeria: 'NG', kenya: 'KE', canada: 'CA', portugal: 'PT', italy: 'IT', italie: 'IT', norway: 'NO', norvege: 'NO', finland: 'FI', finlande: 'FI', switzerland: 'CH', suisse: 'CH',
  austria: 'AT', autriche: 'AT', czechia: 'CZ', czechrepublic: 'CZ', tchequie: 'CZ', ireland: 'IE', irlande: 'IE', slovakia: 'SK', hungary: 'HU', hongrie: 'HU', romania: 'RO', roumanie: 'RO',
  lithuania: 'LT', latvia: 'LV', estonia: 'EE', ukraine: 'UA', turkey: 'TR', turquie: 'TR', greece: 'GR', grece: 'GR', croatia: 'HR', croatie: 'HR', serbia: 'RS', serbie: 'RS', slovenia: 'SI',
  bulgaria: 'BG', iceland: 'IS', luxembourg: 'LU', kuwait: 'KW', koweit: 'KW', qatar: 'QA', bahrain: 'BH', oman: 'OM', jordan: 'JO', jordanie: 'JO', algeria: 'DZ', algerie: 'DZ', tunisia: 'TN', tunisie: 'TN',
  lebanon: 'LB', liban: 'LB', peru: 'PE', perou: 'PE', colombia: 'CO', colombie: 'CO', uruguay: 'UY', paraguay: 'PY', venezuela: 'VE', ecuador: 'EC', equateur: 'EC', bolivia: 'BO', bolivie: 'BO',
  costarica: 'CR', puertorico: 'PR', guatemala: 'GT', philippines: 'PH', malaysia: 'MY', malaisie: 'MY', indonesia: 'ID', indonesie: 'ID', vietnam: 'VN', taiwan: 'TW', hongkong: 'HK', india: 'IN', inde: 'IN', china: 'CN', chine: 'CN',
  iraq: 'IQ', irak: 'IQ', israel: 'IL', ghana: 'GH', zimbabwe: 'ZW', namibia: 'NA', botswana: 'BW',
});
export function parseNation(v: string): string | null {
  if (!v) return null;
  const c = COUNTRY_NAMES[norm(v)];
  if (c && NATION_BY_CODE[c]) return c;
  const up = v.trim().toUpperCase();
  return NATION_BY_CODE[up] ? up : null;
}
function parseRegion(v: string): Region | null {
  const n = norm(v);
  const map: Record<string, Region> = { eu: 'EU', europe: 'EU', na: 'NA', northamerica: 'NA', ameriquedunord: 'NA', sam: 'SAM', sa: 'SAM', southamerica: 'SAM', ameriquedusud: 'SAM', latam: 'SAM', mena: 'MENA', me: 'MENA', middleeast: 'MENA', oce: 'OCE', oceanie: 'OCE', oceania: 'OCE', apac: 'APAC', asia: 'APAC', asie: 'APAC', asiepacifique: 'APAC', apacn: 'APAC', apacs: 'APAC', ssa: 'SSA', africa: 'SSA', afrique: 'SSA', afriquesubsaharienne: 'SSA' };
  return map[n] ?? (REGIONS.includes(v.toUpperCase() as Region) ? v.toUpperCase() as Region : null);
}
function parseRole(v: string): 'starter' | 'sub' | 'academy' | undefined {
  const n = norm(v);
  if (!n) return undefined;
  if (['titulaire', 'starter', 'starting', 'main', 't'].includes(n)) return 'starter';
  if (['remplacant', 'sub', 'substitute', 'remplacante', 'r', 'coachjoueur'].includes(n)) return 'sub';
  if (['academie', 'academy', 'a', 'espoir'].includes(n)) return 'academy';
  return undefined;
}
function parseStyle(v: string): Playstyle | undefined {
  const n = norm(v);
  const s = PLAYSTYLES.find(x => norm(x) === n);
  if (s) return s;
  const map: Record<string, Playstyle> = { aggressive: 'Agressif', striker: 'Agressif', mechanical: 'Mécanique', meca: 'Mécanique', freestyler: 'Mécanique', support: 'Support', anchor: 'Ancre défensive', defensive: 'Ancre défensive', defensif: 'Ancre défensive', ancre: 'Ancre défensive', playmaker: 'Playmaker', passeur: 'Playmaker' };
  return map[n];
}
function parsePosition(v: string): Position | undefined {
  const n = parseInt(v, 10);
  return n === 1 || n === 2 || n === 3 ? n : undefined;
}
const num = (v: string | undefined) => { if (!v) return undefined; const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : undefined; };
function parseTier(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = num(v);
  if (n != null) return Math.max(1, Math.min(5, Math.round(n)));
  const t = norm(v);
  if (t.includes('top4') || t.includes('elite') || t === 's') return 1;
  if (t.includes('worlds') || t.includes('mondial') || t === 'a') return 2;
  if (t.includes('top8') || t.includes('playoff') || t === 'b') return 3;
  if (t.includes('circuit') || t === 'c') return 4;
  if (t.includes('amateur') || t.includes('open') || t === 'd') return 5;
  return undefined;
}

// ---------------------------------------------------------------- auto level
export const TIER_BASE = [0, 90, 86, 81, 75, 67];      // index = tier (1 = top 4 world)
export const TIER_LABEL = ['', 'Top 4 mondial', 'Niveau Worlds', 'Top 8 régional', 'Circuit RLCS', 'Amateur / Open'];
const REGION_MALUS: Record<Region, number> = { EU: 0, NA: 0, SAM: -1, MENA: -1, OCE: -4, APAC: -5, SSA: -5 };

/** Level from team tier, region strength and the player's rating relative to teammates. */
export function autoLevel(tier: number, region: Region | null, rating: number | undefined, teamAvgRating: number | undefined): number {
  let lvl = TIER_BASE[tier] ?? 75;
  if (region) lvl += REGION_MALUS[region];
  if (rating != null && teamAvgRating) lvl += Math.max(-3, Math.min(3, ((rating - teamAvgRating) / teamAvgRating) * 20));
  return Math.round(Math.max(40, Math.min(94, lvl)) * 10) / 10;
}
export function autoPotential(level: number, age: number | null): number {
  const bonus = age == null ? 2 : age < 19 ? 7 : age <= 22 ? 3.5 : age <= 25 ? 1 : 0;
  return Math.min(97, Math.round(level + bonus));
}

export interface CsvResult { db: DbFile; warnings: string[]; stats: { orgs: number; players: number; autoLevels: number } }

/** Build a database from any number of CSV files (players and/or organisations). */
export function csvToDb(files: { name: string; text: string }[], currentYear: number): CsvResult {
  const warnings: string[] = [];
  const orgs: (DbOrg & { tier?: number })[] = [];
  const playerRows: { row: string[]; m: Record<string, number>; file: string; line: number }[] = [];
  for (const f of files) {
    const rows = parseCsv(f.text);
    const kind = detectKind(rows);
    if (kind === 'unknown') { warnings.push(`${f.name} : en-têtes non reconnus (il faut une colonne « pseudo » pour les joueurs, ou « nom » + « region » pour les organisations).`); continue; }
    if (kind === 'orgs') {
      const m = headerMap(rows[0], ['name', 'tag', 'region', 'country', 'hq', 'color1', 'color2', 'tier', 'from']);
      rows.slice(1).forEach((r, i) => {
        const name = r[m.name] ?? '';
        if (!name) return;
        const region = m.region != null ? parseRegion(r[m.region]) : null;
        if (!region) { warnings.push(`${f.name} ligne ${i + 2} : région inconnue « ${r[m.region] ?? ''} » pour ${name}`); return; }
        const country = m.country != null ? parseNation(r[m.country]) : null;
        const hex = (v: string | undefined) => (v && /^#?[0-9a-f]{6}$/i.test(v) ? (v.startsWith('#') ? v : '#' + v) : undefined);
        const c1 = hex(r[m.color1]), c2 = hex(r[m.color2]);
        orgs.push({
          region, name, tag: (r[m.tag] || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3)).toUpperCase().slice(0, 4),
          colors: c1 ? [c1, c2 ?? '#111111'] : undefined, country: country ?? undefined, hq: r[m.hq] || undefined,
          from: r[m.from] || undefined, tier: parseTier(r[m.tier]),
          level: (() => { const t = parseTier(r[m.tier]); return t ? autoLevel(t, region, undefined, undefined) - 1 : undefined; })(),
          reputation: (() => { const t = parseTier(r[m.tier]); return t ? [0, 92, 84, 72, 58, 40][t] : undefined; })(),
        });
      });
    } else {
      const m = headerMap(rows[0], ['tag', 'firstName', 'lastName', 'nationality', 'birthYear', 'org', 'role', 'position', 'playstyle', 'level', 'potential', 'tier', 'rating']);
      rows.slice(1).forEach((r, i) => { if (r[m.tag]) playerRows.push({ row: r, m, file: f.name, line: i + 2 }); });
    }
  }
  // organisations sorted by tier so the strongest real orgs take the strongest slots
  orgs.sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4));
  const orgByName = new Map(orgs.map(o => [norm(o.name), o]));

  // team average ratings
  const teamRatings = new Map<string, number[]>();
  for (const pr of playerRows) {
    const rating = num(pr.row[pr.m.rating]);
    const team = norm(pr.row[pr.m.org] ?? '');
    if (rating != null && team) { const l = teamRatings.get(team) ?? []; l.push(rating); teamRatings.set(team, l); }
  }
  const players: DbPlayer[] = [];
  const seen = new Set<string>();
  let autoLevels = 0;
  for (const { row: r, m, file, line } of playerRows) {
    const tag = r[m.tag];
    if (seen.has(tag.toLowerCase())) { warnings.push(`${file} ligne ${line} : pseudo en double « ${tag} » (ignoré)`); continue; }
    seen.add(tag.toLowerCase());
    const natRaw = m.nationality != null ? r[m.nationality] : '';
    const nat = parseNation(natRaw);
    if (natRaw && !nat) warnings.push(`${tag} : nationalité inconnue « ${natRaw} » (utilisez un code ISO à 2 lettres, ex. FR)`);
    const by = num(r[m.birthYear]);
    const birthYear = by && by > 1950 && by < currentYear ? Math.round(by) : undefined;
    const teamName = m.org != null ? r[m.org] : '';
    const org = teamName ? orgByName.get(norm(teamName)) : undefined;
    const isFree = !teamName || ['libre', 'agentlibre', 'fa', 'freeagent', 'aucune', 'none'].includes(norm(teamName));
    let level = num(r[m.level]);
    if (level == null) {
      const tier = parseTier(r[m.tier]) ?? org?.tier ?? (isFree ? 4 : 4);
      const ratings = teamName ? teamRatings.get(norm(teamName)) : undefined;
      const avg = ratings?.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;
      level = autoLevel(tier, org?.region ?? (nat ? NATION_BY_CODE[nat].region : null), num(r[m.rating]), avg);
      if (isFree) level -= 2;
      autoLevels++;
    }
    if (level > 95) warnings.push(`${tag} : niveau ${level} très élevé (réservez 92+ aux meilleurs du monde)`);
    const age = birthYear ? currentYear - birthYear : null;
    const potential = num(r[m.potential]) ?? autoPotential(level, age);
    const p: DbPlayer = {
      tag, nationality: nat ?? undefined, birthYear, level: Math.round(level), potential: Math.round(Math.max(potential, level)),
      position: m.position != null ? parsePosition(r[m.position]) : undefined,
      playstyle: m.playstyle != null ? parseStyle(r[m.playstyle]) : undefined,
      role: m.role != null ? parseRole(r[m.role]) : undefined,
      org: isFree ? null : teamName,
    };
    if (m.firstName != null) p.firstName = r[m.firstName] ?? '';
    if (m.lastName != null) p.lastName = r[m.lastName] ?? '';
    players.push(p);
  }
  // coherence: rosters
  const perTeam = new Map<string, number>();
  for (const p of players) if (p.org && (p.role ?? 'starter') === 'starter') perTeam.set(p.org, (perTeam.get(p.org) ?? 0) + 1);
  for (const [t, n] of perTeam) {
    if (n > 3) warnings.push(`${t} : ${n} titulaires (3 max) — les plus faibles passeront remplaçants`);
    if (n < 3) warnings.push(`${t} : seulement ${n} titulaire(s) — le jeu complétera avec des joueurs fictifs`);
  }
  const anyPlayer = new Set(players.map(p => p.org).filter(Boolean));
  for (const o of orgs) if (!anyPlayer.has(o.name)) warnings.push(`${o.name} : aucun joueur dans le CSV — garde des joueurs fictifs (calés sur son palier)`);
  const regionCount: Record<string, number> = {};
  for (const o of orgs) regionCount[o.region!] = (regionCount[o.region!] ?? 0) + 1;
  for (const [r, n] of Object.entries(regionCount)) if (n > 16) warnings.push(`${r} : ${n} organisations, seules les 16 premières (par palier) auront une place`);

  return {
    db: { format: 'rlm-db', version: 1, name: files.map(f => f.name).join(' + '), orgs: orgs.map(({ tier, ...o }) => o), players },
    warnings,
    stats: { orgs: orgs.length, players: players.length, autoLevels },
  };
}

// ---------------------------------------------------------------- templates
const BOM = '﻿';
export const ORGS_TEMPLATE = BOM + [
  'nom;tag;region;pays;ville;couleur1;couleur2;palier',
  'Team Exemple;EXE;EU;FR;Paris;#ffcc00;#111111;1',
  'Autre Club;AUT;NA;US;Dallas;#3d8bff;#0b0b1a;3',
].join('\r\n');
export const PLAYERS_TEMPLATE = BOM + [
  'pseudo;prenom;nom;nationalite;naissance;equipe;role;poste;style;niveau;potentiel;palier;rating',
  'JoueurA;;;FR;2004;Team Exemple;titulaire;1;Agressif;;;;0.92',
  'JoueurB;;;BE;2002;Team Exemple;titulaire;2;Playmaker;;;;0.85',
  'JoueurC;;;GB;2003;Team Exemple;titulaire;3;Ancre défensive;;;;0.80',
  'JoueurD;;;FR;2007;Team Exemple;remplacant;2;Mécanique;;;;',
  'JoueurLibre;;;US;2001;libre;;3;Support;78;;;',
].join('\r\n');
export const CSV_HELP = `Colonnes joueurs : pseudo (obligatoire), prenom, nom, nationalite (code ISO ou nom de pays), naissance (année), equipe (nom exact de l'organisation, ou « libre »), role (titulaire / remplacant / academie), poste (1, 2 ou 3), style (Agressif, Playmaker, Mécanique, Support, Ancre défensive), niveau (vide = calcul auto), potentiel (vide = calcul auto selon l'âge), palier (1 à 5, sinon celui de l'équipe), rating (stat de performance, ex. rating Octane).
Colonnes organisations : nom, tag, region (EU, NA, SAM, MENA, OCE, APAC, SSA), pays, ville, couleur1, couleur2 (#rrggbb), palier (1 = top 4 mondial, 2 = niveau Worlds, 3 = top 8 régional, 4 = circuit, 5 = amateur).
Calcul auto : niveau = base du palier (${TIER_BASE.slice(1).join(' / ')}) + malus régional (OCE −4, APAC/SSA −5, SAM/MENA −1) ± jusqu'à 3 points selon le rating du joueur comparé à la moyenne de son équipe.`;
