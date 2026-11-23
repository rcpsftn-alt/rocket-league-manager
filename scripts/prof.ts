import { startCareer } from '../src/engine/world';
import { advanceDay, quickSimUserMatch } from '../src/engine/advance';
const t0 = Date.now();
const g = startCareer({ saveName: 't', managerName: 'Test', managerNationality: 'FR', difficulty: 'normal', season: 2026, mode: 'create', seed: 12345,
  create: { name: 'Test Org', tag: 'TST', region: 'EU', country: 'FR', hq: 'Paris', colors: ['#ff7a18', '#111'], budget: 200000, reputation: 25, ambition: 'Progresser' } });
console.log('gen', Date.now() - t0);
for (let i = 0; i < 20; i++) {
  const t = Date.now();
  const r = advanceDay(g);
  let extra = '';
  if (r === 'match') { const m = g.matches[g.pendingUserMatch!]; const t2 = Date.now(); quickSimUserMatch(g, m); extra = ' usermatch ' + (Date.now() - t2); }
  console.log(g.date, r, Date.now() - t, 'ms', extra);
}
