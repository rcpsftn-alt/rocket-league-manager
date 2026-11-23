// ============================================================================
// Database editing: import / export of "name fix" files (Football Manager
// style). A file renames organisations, players and sponsors and can set a
// player's level, age, nationality and team. Files stay on the user's machine.
// ============================================================================
import type { AttrKey, GameState, Org, Player, Playstyle, Position, Region } from './types';
import { IQ_KEYS, MECH_KEYS, MENTAL_KEYS, PLAYSTYLES, REGIONS } from './types';
import { NATION_BY_CODE } from './data';
import { clamp, newId } from './util';
import { computeCA, defaultContract, generatePlayer, marketValue, ca } from './player';
import { assignPositions, autoLineup, joinOrg, leaveOrg, orgPlayers, starters } from './roster';

export interface DbOrg {
  from?: string;                 // current name to match
  region?: Region;               // or: assign to the N-th strongest org of this region (file order)
  name: string; tag?: string; colors?: [string, string]; country?: string; hq?: string; reputation?: number;
  level?: number;                // target level for the org's remaining (non-imported) players
}
export interface DbPlayer {
  id?: string; from?: string;    // current tag to match; otherwise a new player is created
  tag: string; firstName?: string; lastName?: string; nationality?: string;
  birthYear?: number; level?: number; potential?: number; position?: Position; playstyle?: Playstyle;
  org?: string | null;           // organisation name (after renames); null = free agent
  role?: 'starter' | 'sub' | 'academy';
}
export interface DbSponsor { from: string; name: string }
export interface DbFile { format: 'rlm-db'; version: 1; name?: string; note?: string; orgs?: DbOrg[]; players?: DbPlayer[]; sponsors?: DbSponsor[] }
export interface DbReport { orgs: number; players: number; created: number; sponsors: number; warnings: string[] }

const ALL_KEYS: AttrKey[] = [...MECH_KEYS, ...IQ_KEYS, ...MENTAL_KEYS].filter(k => !['motivation', 'professionalism', 'leadership', 'discipline'].includes(k)) as AttrKey[];

/** Shift a player's attributes so that their overall level equals `level`. */
export function setLevel(p: Player, level: number) {
  for (let i = 0; i < 4; i++) {
    const d = level - computeCA(p.attrs);
    if (Math.abs(d) < 0.05) break;
    for (const k of ALL_KEYS) p.attrs[k] = clamp(p.attrs[k] + d, 5, 99);
  }
  p.hidden.potential = Math.max(p.hidden.potential, computeCA(p.attrs));
}

export function parseDb(text: string): DbFile {
  const d = JSON.parse(text);
  if (!d || typeof d !== 'object') throw new Error('Fichier invalide');
  if (d.format !== 'rlm-db') throw new Error('Format non reconnu (champ "format": "rlm-db" attendu)');
  return d as DbFile;
}

function regionOfNation(code: string | undefined): Region | null { return code ? NATION_BY_CODE[code]?.region ?? null : null; }

export function applyDatabase(g: GameState, db: DbFile): DbReport {
  const rep: DbReport = { orgs: 0, players: 0, created: 0, sponsors: 0, warnings: [] };
  // ---------------- organisations
  const usedSlots = new Set<string>();
  for (const o of db.orgs ?? []) {
    let org: Org | undefined;
    if (o.from) org = Object.values(g.orgs).find(x => !x.disbanded && x.name.toLowerCase() === o.from!.toLowerCase());
    // an org that already carries this name is updated in place (never duplicated)
    if (!org) org = Object.values(g.orgs).find(x => !x.disbanded && x.name.toLowerCase() === o.name.toLowerCase());
    if (org?.isUser) { usedSlots.add(org.id); rep.warnings.push(`${o.name} : c'est votre club, il n'est pas modifié`); continue; }
    if (!org && o.region && REGIONS.includes(o.region)) {
      org = Object.values(g.orgs).filter(x => x.region === o.region && !x.disbanded && !x.isUser && !usedSlots.has(x.id)).sort((a, b) => b.reputation - a.reputation)[0];
    }
    if (!org) { rep.warnings.push(`Organisation non placée : ${o.name}`); continue; }
    usedSlots.add(org.id);
    org.name = o.name;
    if (o.tag) org.tag = o.tag.toUpperCase().slice(0, 4);
    if (o.colors) org.colors = o.colors;
    if (o.country && NATION_BY_CODE[o.country]) org.country = o.country;
    if (o.hq) org.hq = o.hq;
    if (o.reputation != null) org.reputation = clamp(o.reputation, 1, 99);
    rep.orgs++;
  }
  const orgLevels = new Map<string, number>();
  for (const o of db.orgs ?? []) { const org = Object.values(g.orgs).find(x => !x.disbanded && x.name === o.name); if (org && o.level != null) orgLevels.set(org.id, o.level); }
  // ---------------- players
  const tagTaken = (tag: string, except?: Player) => Object.values(g.players).find(p => p !== except && !p.retired && p.tag.toLowerCase() === tag.toLowerCase());
  const touched = new Set<string>();
  for (const d of db.players ?? []) {
    if (!d.tag) continue;
    let p = d.id ? g.players[d.id] : undefined;
    if (!p && d.from) p = tagTaken(d.from);
    if (!p) p = tagTaken(d.tag);
    const target: Org | null | undefined = d.org === undefined ? undefined : d.org === null ? null : Object.values(g.orgs).find(o => !o.disbanded && o.name.toLowerCase() === d.org!.toLowerCase());
    if (d.org && !target) rep.warnings.push(`${d.tag} : organisation « ${d.org} » introuvable, joueur laissé libre`);
    if (!p) {
      const region = target?.region ?? regionOfNation(d.nationality) ?? 'EU';
      p = generatePlayer(g, { region, ca: d.level ?? 70, age: d.birthYear ? +g.date.slice(0, 4) - d.birthYear : 21, tags: new Set() });
      g.players[p.id] = p;
      rep.created++;
    }
    // free the tag if a generated player already uses it
    const clash = tagTaken(d.tag, p);
    if (clash) clash.tag = clash.tag + '_';
    p.tag = d.tag;
    if (d.firstName !== undefined) p.firstName = d.firstName;
    if (d.lastName !== undefined) p.lastName = d.lastName;
    if (d.nationality && NATION_BY_CODE[d.nationality]) { p.nationality = d.nationality; p.region = NATION_BY_CODE[d.nationality].region; }
    if (d.birthYear) p.birth = `${d.birthYear}${p.birth.slice(4)}`;
    if (d.level != null) setLevel(p, clamp(d.level, 20, 97));
    if (d.potential != null) p.hidden.potential = clamp(Math.max(d.potential, ca(p)), 20, 99);
    if (d.position && [1, 2, 3].includes(d.position)) p.position = d.position;
    if (d.playstyle && PLAYSTYLES.includes(d.playstyle)) p.playstyle = d.playstyle;
    if (d.level != null) p.reputation = clamp((d.level - 55) * 2.6, 1, 99), p.popularity = clamp(p.reputation * 0.95, 1, 99);
    if (target !== undefined) {
      if (target === null) { if (p.orgId && !g.orgs[p.orgId].isUser) { leaveOrg(g, p); p.contract = null; } }
      else if (p.orgId && g.orgs[p.orgId]?.isUser) rep.warnings.push(`${p.tag} est dans votre club : il n'est pas transféré`);
      else if (p.orgId !== target.id) {
        const role = d.role ?? 'starter';
        if (role === 'starter') {
          // make room: the weakest starter not coming from the file goes to free agency
          const st = starters(g, target.id).filter(x => !touched.has(x.id));
          if (st.length >= 3 && !target.isUser) { const out = st.sort((a, b) => ca(a) - ca(b))[0]; leaveOrg(g, out); out.contract = null; }
        }
        joinOrg(g, p, target, role);
        defaultContract(g, p, target.reputation);
      }
    }
    p.value = marketValue(g, p);
    touched.add(p.id);
    if (g.userOrgId && p.orgId !== g.userOrgId) g.scout[p.id] = Math.max(g.scout[p.id] ?? 0, clamp(p.reputation, 20, 90));
    rep.players++;
  }
  // calibrate the fictional players left in imported orgs to the org's tier
  for (const [orgId, lvl] of orgLevels) {
    if (g.orgs[orgId].isUser) continue;
    orgPlayers(g, orgId).filter(p => !touched.has(p.id)).forEach((p, i) => {
      setLevel(p, clamp(lvl - (p.squadRole === 'starter' ? 0 : 4) - (i % 3) * 0.8, 30, 95));
      p.value = marketValue(g, p);
    });
  }
  for (const o of Object.values(g.orgs)) {
    if (o.disbanded) continue;
    if (!o.isUser) autoLineup(g, o); else assignPositions(g, o);
  }
  // ---------------- sponsors
  for (const s of db.sponsors ?? []) {
    const sp = Object.values(g.sponsors).find(x => x.name.toLowerCase() === s.from.toLowerCase());
    if (sp) { sp.name = s.name; rep.sponsors++; } else rep.warnings.push(`Sponsor introuvable : ${s.from}`);
  }
  return rep;
}

/** Export the current world as a database file (useful as a template). */
export function exportDatabase(g: GameState): DbFile {
  const orgs = Object.values(g.orgs).filter(o => !o.disbanded);
  return {
    format: 'rlm-db', version: 1, name: `Export ${g.saveName} ${g.date}`,
    orgs: orgs.map(o => ({ from: o.name, name: o.name, tag: o.tag, colors: o.colors, country: o.country, hq: o.hq })),
    players: Object.values(g.players).filter(p => !p.retired && p.orgId).map(p => ({
      from: p.tag, tag: p.tag, firstName: p.firstName, lastName: p.lastName, nationality: p.nationality,
      birthYear: +p.birth.slice(0, 4), level: Math.round(ca(p)), potential: Math.round(p.hidden.potential),
      position: p.position, playstyle: p.playstyle, org: p.orgId ? g.orgs[p.orgId].name : null, role: p.squadRole ?? 'starter',
    })),
    sponsors: Object.values(g.sponsors).map(s => ({ from: s.name, name: s.name })),
  };
}

export { newId, orgPlayers };
