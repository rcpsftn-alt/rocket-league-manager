import { useState } from 'react';
import { useGame, useStore } from '../store';
import type { Match, Region, Tournament } from '../../engine/types';
import { REGIONS } from '../../engine/types';
import { Btn, cx, Empty, OrgLink, Panel, Pill, PlayerLink, Stat, Tabs } from '../components/ui';
import { REGION_INFO } from '../../engine/data';
import { fmtDate, fmtShortDate, money } from '../../engine/util';
import { tMatches } from '../../engine/competitions';
import { avgRating, ca } from '../../engine/player';
import { seriesLine } from './Dashboard';

const KIND_LABEL = { regional: 'Régional', major: 'Major', worlds: 'Mondial', invitational: 'Invitation' };

export function Competitions() {
  const g = useGame();
  const nav = useStore(s => s.nav);
  const [season, setSeason] = useState(g.season);
  const [region, setRegion] = useState<Region | 'ALL'>(g.userOrgId ? g.orgs[g.userOrgId].region : 'EU');
  const seasons = [...new Set(Object.values(g.tournaments).map(t => t.season))].sort((a, b) => b - a);
  const ts = Object.values(g.tournaments).filter(t => t.season === season && (region === 'ALL' || t.region === region || t.region === 'INTL')).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex gap-2 items-center">
        <select value={season} onChange={e => setSeason(+e.target.value)}>{seasons.map(s => <option key={s}>{s}</option>)}</select>
        <div className="flex gap-1">{(['ALL', ...REGIONS] as const).map(r => <Btn key={r} small kind={region === r ? 'primary' : 'default'} onClick={() => setRegion(r)}>{r === 'ALL' ? 'Tout' : r}</Btn>)}</div>
      </div>
      <Panel title={`Circuit RLCS ${season}`} pad={false}>
        <table className="data"><thead><tr><th>Dates</th><th>Compétition</th><th>Type</th><th>Format</th><th>Cashprize</th><th>Statut</th><th>Vainqueur</th><th>Vous</th></tr></thead><tbody>
          {ts.map(t => {
            const w = t.placements.find(p => p.rank === 1);
            const me = g.userOrgId ? t.placements.find(p => p.teamId === g.userOrgId) : undefined;
            return (
              <tr key={t.id} className="cursor-pointer" onClick={() => nav('tournament', t.id)}>
                <td className="text-ink-300">{fmtShortDate(t.start)} – {fmtShortDate(t.end)}</td>
                <td className="font-medium">{t.name}</td>
                <td><Pill tone={t.kind === 'worlds' ? 'accent' : t.kind === 'major' ? 'info' : 'default'}>{KIND_LABEL[t.kind]}</Pill> {t.lan && <Pill tone="accent">LAN</Pill>}</td>
                <td className="text-ink-300 text-[11px]">{t.kind === 'invitational' ? 'Groupes Bo5 → Playoffs Bo7' : 'Suisse Bo5 → Playoffs Bo7'}</td>
                <td className="tnum">{money(t.prizePool)}</td>
                <td>{t.status === 'done' ? <Pill>Terminé</Pill> : t.status === 'live' ? <Pill tone="good">En cours</Pill> : <Pill tone="info">À venir</Pill>}</td>
                <td>{w ? <OrgLink org={g.orgs[w.teamId]} /> : '—'}</td>
                <td>{me ? <span className={cx(me.rank === 1 && 'text-accent font-bold')}>{me.place}</span> : t.status === 'live' && g.userOrgId && t.teamIds.includes(g.userOrgId) ? 'En lice' : ''}</td>
              </tr>
            );
          })}
        </tbody></table>
      </Panel>
    </div>
  );
}

function MatchRow({ m }: { m: Match }) {
  const g = useGame();
  const nav = useStore(s => s.nav);
  const s = seriesLine(g, m, m.teamA);
  const mine = m.teamA === g.userOrgId || m.teamB === g.userOrgId;
  return (
    <div className={cx('flex items-center gap-2 px-2 h-7 border-b border-ink-800 cursor-pointer hover:bg-ink-850', mine && 'bg-accent/5')} onClick={() => nav('match', m.id)}>
      <span className={cx('flex-1 min-w-0 truncate text-right', m.winner === m.teamA && 'font-semibold')}><OrgLink org={g.orgs[m.teamA]} badge={false} /></span>
      <span className="tnum w-12 text-center bg-ink-800 text-xs">{m.played ? `${s.wa} - ${s.wb}` : fmtShortDate(m.date)}</span>
      <span className={cx('flex-1 min-w-0 truncate', m.winner === m.teamB && 'font-semibold')}><OrgLink org={g.orgs[m.teamB]} badge={false} /></span>
    </div>
  );
}

export function TournamentView({ id }: { id: string }) {
  const g = useGame();
  const t = g.tournaments[id];
  const [stageIdx, setStageIdx] = useState(Math.max(0, Math.min(t?.stageIdx ?? 0, (t?.stages.length ?? 1) - 1)));
  if (!t) return <Empty>Compétition introuvable.</Empty>;
  const stage = t.stages[stageIdx];
  const ms = stage ? stage.matchIds.map(mid => g.matches[mid]).filter(Boolean) : [];
  const rounds = [...new Set(ms.map(m => m.round))].sort((a, b) => a - b);
  const all = tMatches(g, t).filter(Boolean);
  // tournament player stats
  const pstats = new Map<string, { goals: number; saves: number; assists: number; r: number; n: number }>();
  for (const m of all) for (const gr of m.games) for (const s of [...gr.statsA, ...gr.statsB]) { const c = pstats.get(s.pid) ?? { goals: 0, saves: 0, assists: 0, r: 0, n: 0 }; c.goals += s.goals; c.saves += s.saves; c.assists += s.assists; c.r += s.rating; c.n++; pstats.set(s.pid, c); }
  const topP = [...pstats.entries()].filter(([, v]) => v.n >= 4).sort((a, b) => b[1].r / b[1].n - a[1].r / a[1].n).slice(0, 10);
  return (
    <div className="p-3 flex flex-col gap-3">
      <Panel pad={false}>
        <div className="flex items-center gap-6 p-3">
          <div className="flex-1"><div className="text-lg font-bold">{t.name}</div><div className="text-ink-300 text-xs">{fmtDate(t.start)} → {fmtDate(t.end)} · {t.lan ? 'LAN' : 'En ligne'} · {t.region === 'INTL' ? 'International' : REGION_INFO[t.region].name}</div></div>
          <Stat label="Cashprize" value={money(t.prizePool)} />
          <Stat label="Équipes" value={t.teamIds.length || (t.kind === 'regional' ? 16 : t.kind === 'invitational' ? 8 : 16)} />
          <Stat label="Statut" value={t.status === 'done' ? 'Terminé' : t.status === 'live' ? 'En cours' : 'À venir'} />
          {t.mvpId && <Stat label="MVP" value={<PlayerLink p={g.players[t.mvpId]} />} />}
        </div>
      </Panel>
      {t.status === 'upcoming' && <Panel title="Qualification"><div className="text-sm text-ink-300">{t.kind === 'regional' ? 'Les 16 organisations de la région participent (têtes de série selon les points du split).' : t.kind === 'major' ? `Qualification selon les points du split ${t.split} : EU 5, NA 4, SAM 2, MENA 2, OCE 1, APAC 1, SSA 1.` : t.kind === 'worlds' ? 'Qualification selon les points de la saison (mêmes quotas régionaux que les Majors).' : 'Invitation des 8 meilleures équipes au classement Elo mondial.'} Inscriptions closes le {fmtDate(t.registrationDeadline)}.</div></Panel>}
      {t.stages.length > 0 && (
        <>
          <Tabs tabs={t.stages.map(s => s.name)} value={stage.name} onChange={n => setStageIdx(t.stages.findIndex(s => s.name === n))} />
          <div className="grid grid-cols-3 gap-3">
            {stage.format !== 'single' && (
              <Panel title="Classement" pad={false}>
                <table className="data"><thead><tr><th>#</th><th>Équipe</th><th>V-D</th><th>Jeux</th><th></th></tr></thead><tbody>
                  {[...stage.standings].sort((a, b) => (a.group ?? 0) - (b.group ?? 0) || b.w - a.w || a.l - b.l || (b.gw - b.gl) - (a.gw - a.gl)).map((s, i) => (
                    <tr key={s.teamId} className={cx(s.teamId === g.userOrgId && 'me')}><td className="text-ink-400">{s.group != null ? 'AB'[s.group] : i + 1}</td><td><OrgLink org={g.orgs[s.teamId]} /></td><td className="tnum">{s.w}-{s.l}</td><td className="tnum text-ink-300">{s.gw}-{s.gl}</td><td>{s.qualified ? <Pill tone="good">Q</Pill> : s.eliminated ? <Pill tone="bad">Éliminé</Pill> : ''}</td></tr>
                  ))}
                </tbody></table>
              </Panel>
            )}
            <div className={cx(stage.format === 'single' ? 'col-span-3' : 'col-span-2', 'flex gap-3 overflow-x-auto')}>
              {rounds.map(r => {
                const rm = ms.filter(m => m.round === r);
                return (
                  <Panel key={r} title={stage.format === 'single' ? rm[0]?.label : stage.format === 'swiss' ? `Ronde ${r + 1}` : `Journée ${r + 1}`} pad={false} className={cx('min-w-[300px] flex-1', stage.format === 'single' && 'justify-center')}>
                    {rm.map(m => <MatchRow key={m.id} m={m} />)}
                  </Panel>
                );
              })}
              {!rounds.length && <Empty>Les matchs seront générés au fil de la compétition.</Empty>}
            </div>
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        {t.placements.length > 0 && (
          <Panel title="Classement final & gains" pad={false}>
            <table className="data"><thead><tr><th>Place</th><th>Équipe</th><th>Gains</th><th>Points</th></tr></thead><tbody>
              {t.placements.map(p => <tr key={p.teamId} className={cx(p.teamId === g.userOrgId && 'me')}><td>{p.place}</td><td><OrgLink org={g.orgs[p.teamId]} /></td><td className="tnum">{money(p.prize)}</td><td className="tnum">{p.points}</td></tr>)}
            </tbody></table>
          </Panel>
        )}
        {topP.length > 0 && (
          <Panel title="Meilleurs joueurs du tournoi" pad={false}>
            <table className="data"><thead><tr><th>Joueur</th><th>Équipe</th><th>MJ</th><th>Buts</th><th>PD</th><th>Arrêts</th><th>Note</th></tr></thead><tbody>
              {topP.map(([pid, v]) => { const p = g.players[pid]; return <tr key={pid}><td><PlayerLink p={p} /></td><td>{p?.orgId ? <OrgLink org={g.orgs[p.orgId]} short /> : ''}</td><td className="tnum">{v.n}</td><td className="tnum">{v.goals}</td><td className="tnum">{v.assists}</td><td className="tnum">{v.saves}</td><td className="tnum font-semibold">{(v.r / v.n).toFixed(2)}</td></tr>; })}
            </tbody></table>
          </Panel>
        )}
      </div>
    </div>
  );
}

export function Schedule() {
  const g = useGame();
  const nav = useStore(s => s.nav);
  const org = g.userOrgId ? g.orgs[g.userOrgId] : null;
  type Ev = { date: string; label: string; kind: 'tournament' | 'match' | 'window' | 'deadline' | 'season'; id?: string; tone?: string };
  const evs: Ev[] = [];
  for (const t of Object.values(g.tournaments)) {
    if (t.season !== g.season) continue;
    if (org && t.region !== org.region && t.region !== 'INTL') continue;
    evs.push({ date: t.start, label: `${t.short} — début${t.lan ? ' (LAN, voyage)' : ''}`, kind: 'tournament', id: t.id });
    evs.push({ date: t.registrationDeadline, label: `${t.short} — clôture des inscriptions / roster lock`, kind: 'deadline', id: t.id });
  }
  if (org) for (const m of Object.values(g.matches)) if ((m.teamA === org.id || m.teamB === org.id) && g.tournaments[m.tournamentId]?.season === g.season) { const opp = g.orgs[m.teamA === org.id ? m.teamB : m.teamA]; evs.push({ date: m.date, label: `${m.played ? (m.winner === org.id ? 'Victoire' : 'Défaite') : 'Match'} vs ${opp.name} — ${m.label}`, kind: 'match', id: m.id }); }
  const y = g.season;
  evs.push({ date: `${y}-03-31`, label: 'Ouverture du mercato (inter-split)', kind: 'window' }, { date: `${y}-05-01`, label: 'Fermeture du mercato', kind: 'window' }, { date: `${y}-07-20`, label: 'Ouverture du mercato (été)', kind: 'window' }, { date: `${y}-08-20`, label: 'Fermeture du mercato', kind: 'window' }, { date: `${y}-10-01`, label: 'Intersaison : mercato ouvert', kind: 'window' }, { date: `${y}-12-31`, label: 'Fin de saison — expiration des contrats', kind: 'season' });
  evs.sort((a, b) => a.date.localeCompare(b.date));
  const months = [...new Set(evs.map(e => e.date.slice(0, 7)))];
  return (
    <div className="p-3 grid grid-cols-3 gap-3">
      {months.map(mo => (
        <Panel key={mo} title={fmtDate(`${mo}-01`).replace(/^1 /, '')} pad={false}>
          {evs.filter(e => e.date.startsWith(mo)).map((e, i) => (
            <div key={i} onClick={() => e.id && nav(e.kind === 'match' ? 'match' : 'tournament', e.id)} className={cx('px-3 py-1.5 border-b border-ink-800 flex gap-3 text-xs', e.id && 'cursor-pointer hover:bg-ink-850', e.date < g.date && 'opacity-50', e.date === g.date && 'bg-accent/10')}>
              <span className="w-12 text-ink-400 shrink-0">{fmtShortDate(e.date)}</span>
              <span className={cx(e.kind === 'match' && 'text-accent', e.kind === 'window' && 'text-good', e.kind === 'deadline' && 'text-ink-400')}>{e.label}</span>
            </div>
          ))}
        </Panel>
      ))}
    </div>
  );
}

export function Rankings() {
  const g = useGame();
  const [tab, setTab] = useState<'Mondial (Elo)' | 'Points circuit' | 'Joueurs' | 'Réputation'>('Mondial (Elo)');
  const [region, setRegion] = useState<Region | 'ALL'>('ALL');
  const orgs = Object.values(g.orgs).filter(o => !o.disbanded && (region === 'ALL' || o.region === region));
  const pts = g.circuitPoints[g.season] ?? {};
  const prevTop = g.rankingHistory[g.rankingHistory.length - 1]?.top ?? [];
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex gap-2 items-center"><Tabs tabs={['Mondial (Elo)', 'Points circuit', 'Joueurs', 'Réputation'] as const} value={tab} onChange={setTab} /><div className="flex-1" /><div className="flex gap-1">{(['ALL', ...REGIONS] as const).map(r => <Btn key={r} small kind={region === r ? 'primary' : 'default'} onClick={() => setRegion(r)}>{r === 'ALL' ? 'Monde' : r}</Btn>)}</div></div>
      <Panel pad={false}>
        {tab === 'Mondial (Elo)' && <table className="data"><thead><tr><th>#</th><th>Organisation</th><th>Région</th><th>Elo</th><th>Saison précédente</th><th>Pts circuit</th><th>Trophées</th></tr></thead><tbody>
          {orgs.sort((a, b) => b.elo - a.elo).slice(0, 60).map((o, i) => { const prev = prevTop.findIndex(x => x.orgId === o.id); return <tr key={o.id} className={cx(o.isUser && 'me')}><td className="tnum">{i + 1}</td><td><OrgLink org={o} /></td><td>{o.region}</td><td className="tnum font-semibold">{o.elo}</td><td className="text-ink-400">{prev >= 0 ? `#${prev + 1}` : '—'}</td><td className="tnum">{pts[o.id] ?? 0}</td><td className="tnum">{o.trophies.length}</td></tr>; })}
        </tbody></table>}
        {tab === 'Points circuit' && <table className="data"><thead><tr><th>#</th><th>Organisation</th><th>Région</th><th>Split 1</th><th>Split 2</th><th>Total saison</th></tr></thead><tbody>
          {orgs.sort((a, b) => (pts[b.id] ?? 0) - (pts[a.id] ?? 0)).slice(0, 60).map((o, i) => <tr key={o.id} className={cx(o.isUser && 'me')}><td>{i + 1}</td><td><OrgLink org={o} /></td><td>{o.region}</td><td className="tnum">{g.splitPoints[`${g.season}-1`]?.[o.id] ?? 0}</td><td className="tnum">{g.splitPoints[`${g.season}-2`]?.[o.id] ?? 0}</td><td className="tnum font-semibold">{pts[o.id] ?? 0}</td></tr>)}
        </tbody></table>}
        {tab === 'Joueurs' && <table className="data"><thead><tr><th>#</th><th>Joueur</th><th>Organisation</th><th>MJ</th><th>Buts/j</th><th>Arrêts/j</th><th>MVP</th><th>Note moyenne</th></tr></thead><tbody>
          {Object.values(g.players).filter(p => !p.retired && p.season.games >= 10 && (region === 'ALL' || p.region === region)).sort((a, b) => avgRating(b.season) - avgRating(a.season)).slice(0, 60).map((p, i) => <tr key={p.id} className={cx(p.orgId === g.userOrgId && 'me')}><td>{i + 1}</td><td><PlayerLink p={p} /></td><td>{p.orgId ? <OrgLink org={g.orgs[p.orgId]} /> : 'Libre'}</td><td className="tnum">{p.season.games}</td><td className="tnum">{(p.season.goals / p.season.games).toFixed(2)}</td><td className="tnum">{(p.season.saves / p.season.games).toFixed(2)}</td><td className="tnum">{p.season.mvps}</td><td className="tnum font-semibold">{avgRating(p.season).toFixed(2)}</td></tr>)}
        </tbody></table>}
        {tab === 'Réputation' && <table className="data"><thead><tr><th>#</th><th>Organisation</th><th>Réputation</th><th>Fans</th><th>Trésorerie (est.)</th></tr></thead><tbody>
          {orgs.sort((a, b) => b.reputation - a.reputation).slice(0, 60).map((o, i) => <tr key={o.id} className={cx(o.isUser && 'me')}><td>{i + 1}</td><td><OrgLink org={o} /></td><td className="tnum">{Math.round(o.reputation)}</td><td className="tnum">{o.fans.toLocaleString('fr-FR')}</td><td className="tnum text-ink-300">{o.isUser ? money(o.balance) : money(Math.round(o.balance / 50000) * 50000)}</td></tr>)}
        </tbody></table>}
      </Panel>
    </div>
  );
}

export function History() {
  const g = useGame();
  const [tab, setTab] = useState<'Palmarès' | 'Records' | 'Ma carrière'>('Palmarès');
  const r = g.records;
  return (
    <div className="p-3 flex flex-col gap-3">
      <Tabs tabs={['Palmarès', 'Records', 'Ma carrière'] as const} value={tab} onChange={setTab} />
      {tab === 'Palmarès' && (g.history.length ? g.history.slice().reverse().map(h => (
        <Panel key={h.season} title={`Saison ${h.season}`} pad={false}>
          <div className="grid grid-cols-3">
            <div className="col-span-2 border-r border-ink-700">
              <table className="data"><thead><tr><th>Compétition</th><th>Vainqueur</th><th>Finaliste</th><th>MVP</th></tr></thead><tbody>
                {h.champions.filter(c => c.kind !== 'regional').concat(h.champions.filter(c => c.kind === 'regional' && g.userOrgId && c.region === g.orgs[g.userOrgId].region)).map((c, i) => <tr key={i}><td>{c.tournament}</td><td className="font-semibold">{c.winnerName}</td><td className="text-ink-300">{c.runnerUpName}</td><td>{c.mvp ?? '—'}</td></tr>)}
              </tbody></table>
            </div>
            <div className="p-3 text-xs">
              <div className="text-ink-400 uppercase text-[10px] mb-1">Top 5 mondial</div>
              {h.topTeams.slice(0, 5).map((t, i) => <div key={t.orgId}>{i + 1}. {t.name} <span className="text-ink-400">({t.elo})</span></div>)}
              <div className="text-ink-400 uppercase text-[10px] mt-3 mb-1">Meilleurs joueurs</div>
              {h.topPlayers.slice(0, 5).map((p, i) => <div key={p.pid}>{i + 1}. {p.tag} <span className="text-ink-400">{p.orgName} · {p.rating}</span></div>)}
              {h.userSummary && <div className="mt-3 text-accent">{h.userSummary}</div>}
            </div>
          </div>
        </Panel>
      )) : <Empty>L'historique se remplira à la fin de chaque saison.</Empty>)}
      {tab === 'Records' && (
        <Panel title="Records de l'écosystème">
          <div className="grid grid-cols-2 gap-4">
            {([['Transfert le plus cher', r.transferFee, (v: number) => money(v)], ['Plus gros gain (tournoi)', r.biggestPrize, (v: number) => money(v)], ['Buts dans une série', r.seriesGoals, (v: number) => `${v}`], ['Score dans un match', r.gameScore, (v: number) => `${v} pts`]] as const).map(([l, rec, f]) => (
              <div key={l} className="border border-ink-700 p-3"><div className="text-[10px] uppercase text-ink-400">{l}</div>{rec ? <><div className="text-xl font-bold text-accent">{f(rec.value)}</div><div className="text-xs text-ink-300">{rec.label} · {fmtDate(rec.date)}</div></> : <div className="text-ink-400">—</div>}</div>
            ))}
          </div>
          <div className="mt-4 text-xs text-ink-300">Joueurs les plus titrés : {Object.values(g.players).sort((a, b) => b.achievements.filter(x => x.startsWith('Champion')).length - a.achievements.filter(x => x.startsWith('Champion')).length).slice(0, 5).map(p => `${p.tag} (${p.achievements.filter(x => x.startsWith('Champion')).length})`).join(', ')}</div>
          <div className="mt-1 text-xs text-ink-300">Plus gros gains en carrière : {Object.values(g.players).sort((a, b) => b.careerEarnings - a.careerEarnings).slice(0, 5).map(p => `${p.tag} (${money(p.careerEarnings)})`).join(', ')}</div>
        </Panel>
      )}
      {tab === 'Ma carrière' && (
        <Panel title={`Carrière de ${g.manager.name}`}>
          <div className="grid grid-cols-4 gap-4 mb-4"><Stat label="Réputation" value={Math.round(g.manager.reputation)} /><Stat label="Saisons" value={g.manager.experience} /><Stat label="Trophées" value={g.manager.trophies.length} /><Stat label="Club actuel" value={g.userOrgId ? g.orgs[g.userOrgId].name : 'Aucun'} /></div>
          <table className="data"><thead><tr><th>Saison</th><th>Organisation</th><th>Bilan</th></tr></thead><tbody>{g.manager.history.map((h, i) => <tr key={i}><td>{h.season}</td><td>{h.orgName}</td><td>{h.result}</td></tr>)}</tbody></table>
          {g.manager.trophies.length > 0 && <div className="mt-3 text-xs">{g.manager.trophies.map((t, i) => <div key={i} className="text-accent">🏆 {t}</div>)}</div>}
        </Panel>
      )}
    </div>
  );
}
export { ca };
