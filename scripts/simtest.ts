import { startCareer } from '../src/engine/world';
import { advanceDay } from '../src/engine/advance';
import { quickSimUserMatch } from '../src/engine/advance';
import { ca, avgRating } from '../src/engine/player';
import { starters } from '../src/engine/roster';
import { money } from '../src/engine/util';

const seasons = +(process.argv[2] ?? 2);
const t0 = Date.now();
const g = startCareer({ saveName: 't', managerName: 'Test', managerNationality: 'FR', difficulty: 'normal', season: 2026, mode: 'create', seed: 12345,
  create: { name: 'Test Org', tag: 'TST', region: 'EU', country: 'FR', hq: 'Paris', colors: ['#ff7a18', '#111'], budget: 200000, reputation: 25, ambition: 'Progresser' } });
console.log('gen', Date.now() - t0, 'ms; players', Object.keys(g.players).length, 'orgs', Object.keys(g.orgs).length);
let days = 0;
const goals: number[] = []; const scores: Record<string, number> = {};
while (g.season < 2026 + seasons && !g.gameOver) {
  const r = advanceDay(g);
  if (r === 'match') { const m = g.matches[g.pendingUserMatch!]; quickSimUserMatch(g, m); }
  days++;
  if (days > 400 * seasons + 50) break;
}
for (const m of Object.values(g.matches)) for (const gr of m.games) { goals.push(gr.scoreA + gr.scoreB); const k = `${Math.max(gr.scoreA, gr.scoreB)}-${Math.min(gr.scoreA, gr.scoreB)}`; scores[k] = (scores[k] ?? 0) + 1; }
console.log('days', days, 'time', Date.now() - t0, 'ms', 'date', g.date, 'gameOver', g.gameOver);
console.log('avg goals/game', (goals.reduce((a, b) => a + b, 0) / goals.length).toFixed(2), 'games', goals.length);
console.log('scorelines', Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}:${v}`).join(' '));
for (const h of g.history) {
  console.log(`--- Season ${h.season}`);
  for (const c of h.champions.filter(c => c.kind !== 'regional' || c.region === 'EU')) console.log(`  ${c.tournament}: ${c.winnerName} > ${c.runnerUpName} MVP ${c.mvp}`);
  console.log('  top teams', h.topTeams.slice(0, 6).map(t => `${t.name}(${t.elo})`).join(', '));
  console.log('  top players', h.topPlayers.slice(0, 5).map(p => `${p.tag} ${p.rating}`).join(', '));
  console.log('  user:', h.userSummary);
}
const u = g.orgs[g.userOrgId ?? ''];
if (u) console.log('user org bal', money(u.balance), 'debt', money(u.debt), 'elo', u.elo, 'starters', starters(g, u.id).map(p => `${p.tag}:${ca(p).toFixed(1)}`).join(' '));
const orgs = Object.values(g.orgs).filter(o => !o.disbanded);
const bals = orgs.map(o => o.balance).sort((a, b) => a - b);
console.log('org balances min/med/max', money(bals[0]), money(bals[Math.floor(bals.length / 2)]), money(bals[bals.length - 1]), 'disbanded', Object.values(g.orgs).filter(o => o.disbanded).length);
const active = Object.values(g.players).filter(p => !p.retired);
const top = active.sort((a, b) => ca(b) - ca(a)).slice(0, 8);
console.log('top CA', top.map(p => `${p.tag}:${ca(p).toFixed(1)}/${p.hidden.potential.toFixed(0)}`).join(' '));
console.log('transfers', g.transfersLog.length, 'news', g.news.length, 'save size', (JSON.stringify(g).length / 1e6).toFixed(2), 'MB');
import { forecastMonth, totalFollowers } from '../src/engine/finance';
for (const o of Object.values(g.orgs).filter(o => !o.disbanded).sort((a, b) => b.balance - a.balance).slice(0, 4)) {
  console.log(o.name, money(o.balance), 'rep', o.reputation.toFixed(0), 'fans', o.fans, 'foll', totalFollowers(o), JSON.stringify(forecastMonth(g, o)));
}
