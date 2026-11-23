import { generateWorld } from '../src/engine/world';
import { generatePlayer } from '../src/engine/player';
import { buildSide, GameSim } from '../src/engine/matchsim';
import { createOrg } from '../src/engine/world';
const g = generateWorld(7, 2026, 'normal');
const tags = new Set<string>();
function team(c: number) {
  const o = createOrg(g, 'EU', 3, new Set());
  const ps = [1, 2, 3].map(i => { const p = generatePlayer(g, { region: 'EU', ca: c, age: 21, tags }); p.cond.form = 50; p.cond.fatigue = 10; p.cond.morale = 60; p.cond.burnout = 0; p.position = i as 1 | 2 | 3; o.positions[p.id] = i as 1|2|3; return p; });
  return { o, ps };
}
for (const [a, b] of [[70, 70], [72, 70], [75, 70], [80, 70], [85, 70], [90, 80]]) {
  let wins = 0, goals = 0, shots = 0, saves = 0, rs: number[] = [];
  const N = 600;
  for (let i = 0; i < N; i++) {
    const A = team(a), B = team(b);
    const sa = buildSide(g, A.o, A.ps, 0.3), sb = buildSide(g, B.o, B.ps, 0.3);
    const sim = new GameSim(sa, sb, 0.3); sim.runToEnd(); const r = sim.result();
    if (r.scoreA > r.scoreB) wins++;
    goals += r.scoreA + r.scoreB; shots += [...r.statsA, ...r.statsB].reduce((x, s) => x + s.shots, 0); saves += [...r.statsA, ...r.statsB].reduce((x, s) => x + s.saves, 0);
    rs.push(...r.statsA.map(s => s.rating));
  }
  const bo5 = (p: number) => { let s = 0; const C = (n: number, k: number) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; }; for (let l = 0; l < 3; l++) s += C(2 + l, l) * p ** 3 * (1 - p) ** l; return s; };
  const p = wins / N;
  console.log(`${a} vs ${b}: game win ${(p * 100).toFixed(1)}%  Bo5 ${(bo5(p) * 100).toFixed(1)}%  goals/g ${(goals / N).toFixed(2)} shots/g ${(shots / N).toFixed(1)} saves/g ${(saves / N).toFixed(1)} ratingA ${(rs.reduce((x, y) => x + y, 0) / rs.length).toFixed(2)}`);
}
