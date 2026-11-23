import { readFileSync } from 'fs';
import { csvToDb } from '../src/engine/csvdb';
import { applyDatabase } from '../src/engine/moddb';
import { startCareer } from '../src/engine/world';
import { starters } from '../src/engine/roster';
import { ca } from '../src/engine/player';
const dir = process.argv[2];
const r = csvToDb(['orgs.csv', 'players.csv'].map(n => ({ name: n, text: readFileSync(`${dir}/${n}`, 'utf8') })), 2026);
console.log(r.stats, r.warnings);
console.log(r.db.players!.map(p => `${p.tag}:${p.level}/${p.potential} ${p.nationality} ${p.org}`).join(' | '));
const g = startCareer({ saveName: 't', managerName: 'T', managerNationality: 'FR', difficulty: 'normal', season: 2026, mode: 'unemployed', seed: 5 });
const rep = applyDatabase(g, r.db); console.log(rep);
for (const n of ['Team Vitality', 'Karmine Corp', 'Gentle Mates', 'Pioneers']) { const o = Object.values(g.orgs).find(x => x.name === n)!; console.log(n, o.region, starters(g, o.id).map(p => `${p.tag}:${ca(p).toFixed(0)}`).join(' ')); }
const fg = Object.values(g.players).find(p => p.tag === 'FreeGuy')!; console.log('FreeGuy', fg.orgId, fg.nationality, ca(fg).toFixed(0));
