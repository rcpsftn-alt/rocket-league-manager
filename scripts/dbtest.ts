import { readFileSync } from 'fs';
import { startCareer } from '../src/engine/world';
import { parseDb, applyDatabase } from '../src/engine/moddb';
import { starters } from '../src/engine/roster';
import { ca } from '../src/engine/player';
import { advanceDay, quickSimUserMatch } from '../src/engine/advance';
const db = parseDb(readFileSync('realnames/rlcs-noms-reels.json', 'utf8'));
const g = startCareer({ saveName: 't', managerName: 'T', managerNationality: 'FR', difficulty: 'normal', season: 2026, mode: 'unemployed', seed: 99, db });
for (const name of ['Team Vitality', 'Karmine Corp', 'Team Falcons', 'NRG Esports', 'Gentle Mates']) {
  const o = Object.values(g.orgs).find(x => x.name === name)!;
  console.log(name, o.tag, o.region, Math.round(o.reputation), starters(g, o.id).map(p => `${p.tag}:${ca(p).toFixed(0)}`).join(' '));
}
const r = applyDatabase(g, db); console.log('reapply', r.players, r.created, r.warnings.slice(0, 3));
for (let i = 0; i < 120; i++) { if (advanceDay(g) === 'match') quickSimUserMatch(g, g.matches[g.pendingUserMatch!]); }
console.log(g.date, g.news.slice(0, 3).map(n => n.title));
