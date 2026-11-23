import { useEffect, useRef, useState } from 'react';
import { useGame, useStore, act } from '../store';
import type { Match, MatchEvent, Tactic } from '../../engine/types';
import { Btn, cx, Empty, OrgBadge, OrgLink, Panel, Pill, PlayerLink, AbilityCell } from '../components/ui';
import { GameSim, betweenGames, recompute, type SideCtx } from '../../engine/matchsim';
import { aggregateSeries, prepareSides, seriesNeeded, seriesScore, matchImportance } from '../../engine/results';
import { finishUserMatch, quickSimUserMatch } from '../../engine/advance';
import { lineup } from '../../engine/roster';
import { rngGet, rngSet, fmtDate } from '../../engine/util';
import { staffByRole } from '../../engine/staff';
import { recentForm } from '../../engine/player';

const fmtT = (t: number) => t > 300 ? `+${Math.floor((t - 300) / 60)}:${String((t - 300) % 60).padStart(2, '0')}` : `${Math.floor((300 - t) / 60)}:${String((300 - t) % 60).padStart(2, '0')}`;

export function MatchScreen({ id }: { id: string }) {
  const g = useGame();
  const m = g.matches[id];
  const [live, setLive] = useState(false);
  if (!m) return <Empty>Match introuvable (archivé).</Empty>;
  const mine = m.teamA === g.userOrgId || m.teamB === g.userOrgId;
  if (live || (mine && !m.played && m.games.length > 0 && g.pendingUserMatch === m.id && live)) return <LiveMatch m={m} onExit={() => setLive(false)} />;
  if (!m.played && mine && g.pendingUserMatch === m.id) return <PreMatch m={m} onLive={() => setLive(true)} />;
  if (!m.played) return <Panel title="Match à venir"><div className="text-sm">{g.orgs[m.teamA].name} vs {g.orgs[m.teamB].name} — {fmtDate(m.date)} ({m.label})</div></Panel>;
  return <MatchReport m={m} />;
}

function PreMatch({ m, onLive }: { m: Match; onLive: () => void }) {
  const g = useGame();
  const { nav } = useStore();
  const me = g.orgs[g.userOrgId!];
  const oppId = m.teamA === me.id ? m.teamB : m.teamA;
  const opp = g.orgs[oppId];
  const t = g.tournaments[m.tournamentId];
  const analyst = staffByRole(g, me.id, 'Analyste');
  const oppRecent = Object.values(g.matches).filter(x => x.played && (x.teamA === oppId || x.teamB === oppId)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const [wa, wb] = seriesScore(m);
  const tl = (v: number, l: string[]) => l[v + 2] ?? '?';
  return (
    <div className="flex flex-col gap-4">
      <div className="card relative overflow-hidden p-7 flex items-center justify-center gap-6 @3xl:gap-14 flex-wrap" style={{ background: 'linear-gradient(90deg, #3d8bff2e 0%, #3d8bff08 35%, transparent 50%, #ff8a1f08 65%, #ff8a1f2e 100%), linear-gradient(180deg, #151a24, #121620)' }}>
        <div className="flex items-center gap-3"><OrgBadge org={g.orgs[m.teamA]} size={72} /><div className="text-xl font-bold">{g.orgs[m.teamA].name}</div></div>
        <div className="text-center"><div className="text-[11px] text-ink-400 uppercase">{t.short} · {m.label}</div><div className="text-3xl font-black tnum">{m.games.length ? `${wa} - ${wb}` : 'VS'}</div><div className="text-xs text-ink-300">Best of {m.bestOf} · importance {Math.round(matchImportance(g, m) * 100)}%</div></div>
        <div className="flex items-center gap-3"><div className="text-xl font-bold">{g.orgs[m.teamB].name}</div><OrgBadge org={g.orgs[m.teamB]} size={72} /></div>
      </div>
      <div className="flex gap-2 justify-center">
        <Btn kind="primary" className="h-9 px-6 text-sm" onClick={onLive}>▶ Suivre en direct</Btn>
        <Btn className="h-9 px-6 text-sm" onClick={() => act(gs => quickSimUserMatch(gs, gs.matches[m.id]))}>Simulation rapide</Btn>
        <Btn className="h-9" onClick={() => nav('tactics')}>Ajuster la tactique</Btn>
      </div>
      <div className="grid grid-cols-1 @4xl:grid-cols-3 gap-4">
        {[me, opp].map(o => (
          <Panel key={o.id} title={`Lineup ${o.tag}`} pad={false}>
            <table className="data"><tbody>{lineup(g, o).map(p => <tr key={p.id}><td><PlayerLink p={p} /></td><td className="text-ink-300">{o.positions[p.id] ?? p.position}e · {p.playstyle}</td><td><AbilityCell g={g} p={p} /></td><td className="tnum text-ink-300">{recentForm(p) ? recentForm(p).toFixed(1) : '—'}</td></tr>)}</tbody></table>
          </Panel>
        ))}
        <Panel title={`Rapport d'analyse — ${opp.tag}`}>
          <div className="text-xs flex flex-col gap-1.5">
            <div>Elo : <b>{opp.elo}</b> (vous : {me.elo})</div>
            <div>Forme : {oppRecent.map(x => <span key={x.id} className={cx('font-bold mr-1', x.winner === oppId ? 'text-good' : 'text-bad')}>{x.winner === oppId ? 'V' : 'D'}</span>)}</div>
            {analyst ? <>
              <div>Pression : <b>{tl(opp.tactic.pressure, ['Très défensif', 'Prudent', 'Équilibré', 'Offensif', 'Pressing total'])}</b></div>
              <div>Rythme : <b>{tl(opp.tactic.tempo, ['Très lent', 'Contrôlé', 'Normal', 'Rapide', 'Frénétique'])}</b></div>
              <div>Démos : <b>{['Rares', 'Opportunistes', 'Focus'][opp.tactic.demos]}</b> · Rotations : <b>{opp.tactic.rotation}</b></div>
              <div className="text-ink-400 mt-1">Votre analyste ({analyst.name}) apporte aussi un léger avantage de préparation en match.</div>
            </> : <div className="text-ink-400">Engagez un analyste pour connaître les consignes adverses et gagner un avantage de préparation.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

const QUICK: { label: string; patch: Partial<Tactic> }[] = [
  { label: 'Pressing ↑', patch: { pressure: 2 } }, { label: 'Défendre ↓', patch: { pressure: -1 } }, { label: 'Équilibré', patch: { pressure: 0, tempo: 0, challenges: 0 } },
  { label: 'Accélérer', patch: { tempo: 2 } }, { label: 'Ralentir', patch: { tempo: -2 } }, { label: 'Focus démos', patch: { demos: 2 } },
  { label: 'Contrôle boost', patch: { boostControl: 2 } }, { label: 'Moins de challenges', patch: { challenges: -2 } }, { label: 'Rotations serrées', patch: { rotation: 'tight' } },
];

function LiveMatch({ m, onExit }: { m: Match; onExit: () => void }) {
  const g = useGame();
  const nav = useStore(s => s.nav);
  const userA = m.teamA === g.userOrgId;
  const ref = useRef<{ A: SideCtx; B: SideCtx; imp: number; sim: GameSim | null; rng: number } | null>(null);
  if (!ref.current) {
    rngSet(g.rngState);
    const [A, B, imp] = prepareSides(g, m);
    ref.current = { A, B, imp, sim: null, rng: rngGet() };
  }
  const [, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(g.settings.liveSpeed ?? 2);
  const [feed, setFeed] = useState<MatchEvent[]>([]);
  const [done, setDone] = useState(false);
  const r = ref.current;
  const [wa, wb] = seriesScore(m);
  const need = seriesNeeded(m);

  const newGame = () => {
    const [a, b] = seriesScore(m);
    rngSet(r.rng);
    r.sim = new GameSim(r.A, r.B, r.imp, (a === need - 1 || b === need - 1) ? 0.5 : 0);
    r.rng = rngGet();
    setFeed(r.sim.st.events.slice());
    setRunning(true);
  };
  const endGame = () => {
    const sim = r.sim!;
    const res = sim.result(true);
    m.games.push(res);
    const aWon = res.scoreA > res.scoreB;
    rngSet(r.rng); betweenGames(aWon ? r.B : r.A, true, r.imp); betweenGames(aWon ? r.A : r.B, false, r.imp); r.rng = rngGet();
    r.sim = null;
    setRunning(false);
    const [a, b] = seriesScore(m);
    if (a >= need || b >= need) {
      m.rosterA = r.A.players.map(x => x.p.id); m.rosterB = r.B.players.map(x => x.p.id);
      useStore.getState().g!.rngState = r.rng;
      act(gs => finishUserMatch(gs, gs.matches[m.id]));
      setDone(true);
    } else act(() => {}, { save: true });
    setTick(x => x + 1);
  };
  const stepOnce = () => {
    const sim = r.sim; if (!sim) return;
    rngSet(r.rng);
    const ev = sim.step();
    r.rng = rngGet();
    if (ev.length) setFeed(f => [...ev.slice().reverse(), ...f].slice(0, 120));
    if (sim.st.over) endGame();
    setTick(x => x + 1);
  };
  useEffect(() => {
    if (!running) return;
    const ms = [1400, 800, 380, 120][speed] ?? 380;
    const h = setInterval(stepOnce, ms);
    return () => clearInterval(h);
  });
  useEffect(() => { if (!r.sim && !done && !m.played) newGame(); }, []);

  const finishGameNow = () => { const sim = r.sim; if (!sim) return; rngSet(r.rng); while (!sim.st.over) { const ev = sim.step(); if (ev.length) setFeed(f => [...ev.slice().reverse(), ...f].slice(0, 120)); } r.rng = rngGet(); endGame(); };
  const simRest = () => {
    if (r.sim) finishGameNow();
    const mm = useStore.getState().g!.matches[m.id];
    if (mm.played) return;
    useStore.getState().g!.rngState = r.rng;
    act(gs => quickSimUserMatch(gs, gs.matches[m.id]));
    setDone(true);
  };
  const applyTactic = (patch: Partial<Tactic>, label: string) => {
    const side = userA ? r.A : r.B;
    side.tactic = { ...side.tactic, ...patch };
    recompute(side);
    act(gs => { Object.assign(gs.orgs[gs.userOrgId!].tactic, patch); }, { save: false });
    const ev: MatchEvent = { t: r.sim?.st.t ?? 0, kind: 'tactic', team: userA ? 0 : 1, text: `Consigne du staff : ${label}` };
    r.sim?.st.events.push(ev);
    setFeed(f => [ev, ...f]);
  };

  const sim = r.sim;
  const st = sim?.st;
  const last = m.games[m.games.length - 1];
  const scoreA = st ? st.scoreA : last?.scoreA ?? 0, scoreB = st ? st.scoreB : last?.scoreB ?? 0;
  const mom = st ? st.momentum : 0;
  const statsRows = (side: SideCtx) => side.players.map(sp => ({ sp, s: st?.stats.get(sp.p.id) }));
  const A = g.orgs[m.teamA], B = g.orgs[m.teamB];
  return (
    <div className="flex flex-col gap-4">
      <div className="card relative overflow-hidden" style={{ background: 'linear-gradient(90deg, #3d8bff2e 0%, #3d8bff08 35%, transparent 50%, #ff8a1f08 65%, #ff8a1f2e 100%), linear-gradient(180deg, #151a24, #121620)' }}>
        <div className="flex items-center justify-center gap-8 py-4">
          <div className="flex items-center gap-3 w-72 justify-end"><div className="text-right"><div className="text-lg font-bold">{A.name}</div><div className="text-[11px] text-ink-400">Chimie {Math.round(r.A.chem)}%</div></div><OrgBadge org={A} size={60} /></div>
          <div className="text-center">
            <div className="flex items-center gap-4"><span className="text-6xl font-black tnum text-[#7fb2ff]">{scoreA}</span><span className="text-ink-500">:</span><span className="text-6xl font-black tnum text-[#ffb066]">{scoreB}</span></div>
            <div className={cx('text-sm font-mono mt-1', st?.ot ? 'text-accent' : 'text-ink-200')}>{st ? (st.ot ? 'PROLONGATION ' : '') + fmtT(st.t) : done || m.played ? 'TERMINÉ' : 'ENTRE-JEUX'}</div>
          </div>
          <div className="flex items-center gap-3 w-72"><OrgBadge org={B} size={60} /><div><div className="text-lg font-bold">{B.name}</div><div className="text-[11px] text-ink-400">Chimie {Math.round(r.B.chem)}%</div></div></div>
        </div>
        <div className="flex items-center justify-center gap-6 pb-3">
          <div className="flex gap-1">{Array.from({ length: need }).map((_, i) => <span key={i} className={cx('w-3.5 h-3.5 rounded-full border', i < wa ? 'bg-[#3d8bff] border-[#3d8bff]' : 'border-ink-500')} />)}</div>
          <span className="text-xs text-ink-300">Série Bo{m.bestOf} · Jeu {Math.min(m.games.length + (sim ? 1 : 0), m.bestOf)}</span>
          <div className="flex gap-1">{Array.from({ length: need }).map((_, i) => <span key={i} className={cx('w-3.5 h-3.5 rounded-full border', i < wb ? 'bg-accent border-accent' : 'border-ink-500')} />)}</div>
        </div>
        <div className="px-6 pb-3"><div className="text-[10px] text-ink-400 text-center mb-1">MOMENTUM</div><div className="h-1.5 bg-ink-700 relative"><div className="absolute top-0 h-1.5 bg-accent transition-all" style={{ left: mom >= 0 ? '50%' : `${50 + mom * 80}%`, width: `${Math.abs(mom) * 80}%` }} /><div className="absolute left-1/2 top-[-2px] w-px h-2.5 bg-ink-300" /></div></div>
      </div>

      <div className="flex gap-2 items-center">
        {sim && <Btn onClick={() => setRunning(!running)}>{running ? '❚❚ Pause' : '▶ Reprendre'}</Btn>}
        {sim && <div className="flex">{['×0.5', '×1', '×2', '×4'].map((l, i) => <Btn key={l} small kind={speed === i ? 'primary' : 'default'} onClick={() => { setSpeed(i); act(gs => { gs.settings.liveSpeed = i; }, { save: false }); }}>{l}</Btn>)}</div>}
        {sim && <Btn onClick={finishGameNow}>Aller à la fin du jeu</Btn>}
        {!sim && !done && !m.played && <Btn kind="primary" onClick={newGame}>Lancer le jeu {m.games.length + 1}</Btn>}
        {!done && !m.played && <Btn onClick={simRest}>Simuler le reste de la série</Btn>}
        {(done || m.played) && <Btn kind="primary" onClick={() => { onExit(); nav('match', m.id); }}>Voir le rapport</Btn>}
        <div className="flex-1" />
        <Btn kind="ghost" onClick={() => { setRunning(false); onExit(); }}>Quitter (match en pause)</Btn>
      </div>

      <div className="grid grid-cols-1 @5xl:grid-cols-[1fr_380px] gap-4">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
            {([r.A, r.B] as SideCtx[]).map((side, si) => (
              <Panel key={si} title={side.name} pad={false}>
                <table className="data"><thead><tr><th>Joueur</th><th>Score</th><th>B</th><th>PD</th><th>Arr.</th><th>Tirs</th><th>Dém.</th></tr></thead><tbody>
                  {statsRows(side).map(({ sp, s }) => <tr key={sp.p.id}><td><PlayerLink p={sp.p} /></td><td className="tnum font-semibold">{s?.score ?? 0}</td><td className="tnum">{s?.goals ?? 0}</td><td className="tnum">{s?.assists ?? 0}</td><td className="tnum">{s?.saves ?? 0}</td><td className="tnum">{s?.shots ?? 0}</td><td className="tnum">{s?.demos ?? 0}</td></tr>)}
                </tbody></table>
              </Panel>
            ))}
          </div>
          <Panel title="Consignes en direct" right={<span>Vos changements modifient immédiatement le profil de l'équipe dans le moteur</span>}>
            <div className="flex flex-wrap gap-2">{QUICK.map(q => <Btn key={q.label} small onClick={() => applyTactic(q.patch, q.label)} disabled={done}>{q.label}</Btn>)}</div>
            <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
              {(['attack', 'defense', 'control', 'rotation'] as const).map(k => { const mySide = userA ? r.A : r.B, op = userA ? r.B : r.A; return <div key={k}><div className="text-ink-400 text-[10px] uppercase">{({ attack: 'Attaque', defense: 'Défense', control: 'Contrôle', rotation: 'Rotations' })[k]}</div><div className="tnum"><b className={mySide[k] >= op[k] ? 'text-good' : 'text-bad'}>{mySide[k].toFixed(1)}</b> <span className="text-ink-400">vs {op[k].toFixed(1)}</span></div></div>; })}
            </div>
          </Panel>
          {m.games.length > 0 && <Panel title="Jeux de la série" pad={false}><table className="data"><tbody>{m.games.map((gr, i) => <tr key={i}><td>Jeu {i + 1}</td><td className="tnum font-semibold">{gr.scoreA} - {gr.scoreB}{gr.ot ? ' (prol.)' : ''}</td><td className="text-ink-300">{gr.scoreA > gr.scoreB ? A.tag : B.tag}</td><td className="text-ink-400">Possession {Math.round(gr.possessionA * 100)}%</td></tr>)}</tbody></table></Panel>}
        </div>
        <Panel title="Fil du match" pad={false}>
          <div className="max-h-[520px] overflow-auto">
            {feed.map((e, i) => (
              <div key={feed.length - i} className={cx('px-3 py-1.5 border-b border-ink-800 text-xs flex gap-2', i === 0 && 'flash', e.kind === 'goal' && 'bg-accent/10 font-semibold', e.kind === 'tactic' && 'text-info')}>
                <span className="font-mono text-ink-400 w-12 shrink-0">{fmtT(e.t)}</span>
                <span className={cx(e.kind === 'goal' ? (e.team === 0 ? 'text-[#7fb2ff]' : 'text-[#ffb066]') : e.kind === 'save' ? 'text-ink-200' : 'text-ink-300')}>{e.text}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MatchReport({ m }: { m: Match }) {
  const g = useGame();
  const A = g.orgs[m.teamA], B = g.orgs[m.teamB];
  const [wa, wb] = seriesScore(m);
  const agg = [...aggregateSeries(m).values()];
  const t = g.tournaments[m.tournamentId];
  const withEvents = m.games.map((gr, i) => ({ gr, i })).filter(x => x.gr.events?.length);
  const [gi, setGi] = useState(withEvents.length ? withEvents[withEvents.length - 1].i : -1);
  return (
    <div className="flex flex-col gap-4">
      <div className="card relative overflow-hidden py-7 flex items-center justify-center gap-10 flex-wrap" style={{ background: 'linear-gradient(90deg, #3d8bff2e 0%, #3d8bff08 35%, transparent 50%, #ff8a1f08 65%, #ff8a1f2e 100%), linear-gradient(180deg, #151a24, #121620)' }}>
        <div className="flex items-center gap-3"><OrgLink org={A} /></div>
        <div className="text-center"><div className="text-[11px] text-ink-400 uppercase">{t.short} · {m.label} · {fmtDate(m.date)}</div><div className="text-4xl font-black tnum">{wa} - {wb}</div></div>
        <div className="flex items-center gap-3"><OrgLink org={B} /></div>
      </div>
      <div className="grid grid-cols-1 @4xl:grid-cols-3 gap-4">
        <Panel title="Jeux" pad={false}><table className="data"><tbody>{m.games.map((gr, i) => <tr key={i} className={cx(!!gr.events?.length && 'cursor-pointer', gi === i && 'me')} onClick={() => gr.events?.length && setGi(i)}><td>Jeu {i + 1}</td><td className="tnum font-semibold">{gr.scoreA} - {gr.scoreB}{gr.ot ? ' (prol.)' : ''}</td><td>{gr.scoreA > gr.scoreB ? A.tag : B.tag}</td><td className="text-ink-400 tnum">{Math.round(gr.possessionA * 100)}% poss.</td></tr>)}</tbody></table></Panel>
        <Panel title="Statistiques de la série" className="@4xl:col-span-2" pad={false}>
          {agg.length ? <table className="data"><thead><tr><th>Joueur</th><th>Équipe</th><th>Score</th><th>Buts</th><th>PD</th><th>Arrêts</th><th>Tirs</th><th>Démos</th><th>Note</th></tr></thead><tbody>
            {agg.sort((a, b) => b.rating - a.rating).map((s, i) => <tr key={s.pid}><td><PlayerLink p={g.players[s.pid]} />{i === 0 && <span className="ml-1"><Pill tone="accent">MVP</Pill></span>}</td><td>{s.side === 'A' ? A.tag : B.tag}</td><td className="tnum">{s.score}</td><td className="tnum">{s.goals}</td><td className="tnum">{s.assists}</td><td className="tnum">{s.saves}</td><td className="tnum">{s.shots}</td><td className="tnum">{s.demos}</td><td className="tnum font-semibold">{s.rating.toFixed(2)}</td></tr>)}
          </tbody></table> : <Empty>Statistiques détaillées archivées.</Empty>}
        </Panel>
      </div>
      {gi >= 0 && m.games[gi]?.events && (
        <Panel title={`Résumé du jeu ${gi + 1}`} pad={false}>
          <div className="max-h-96 overflow-auto">{m.games[gi].events!.filter(e => e.kind !== 'shot').map((e, i) => <div key={i} className={cx('px-3 py-1 border-b border-ink-800 text-xs flex gap-2', e.kind === 'goal' && 'text-accent font-semibold')}><span className="font-mono text-ink-400 w-12">{fmtT(e.t)}</span>{e.text}</div>)}</div>
        </Panel>
      )}
    </div>
  );
}
