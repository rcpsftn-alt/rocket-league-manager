import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGame, useStore, act } from '../store';
import { Avatar, Bar, Btn, CondDot, cx, Empty, moraleLabel, moraleTone, OrgBadge, OrgLink, Panel, Pill, PlayerLink, Stat, AbilityCell } from '../components/ui';
import { Kpis } from '../components/ui';
import { fmtDate, fmtShortDate, money } from '../../engine/util';
import { orgPlayers } from '../../engine/roster';
import { userNextMatch } from '../../engine/competitions';
import { forecastMonth, bankruptcyRisk } from '../../engine/finance';
import { recentForm } from '../../engine/player';
import { vacancies, applyForJob } from '../../engine/ai';
import { respondIncoming } from '../../engine/transfers';
import { REGION_INFO } from '../../engine/data';
import { teamChemistry } from '../../engine/chemistry';
import type { GameState, Match } from '../../engine/types';

export function regionRank(g: GameState, orgId: string) {
  const o = g.orgs[orgId];
  return Object.values(g.orgs).filter(x => x.region === o.region && !x.disbanded).sort((a, b) => b.elo - a.elo).findIndex(x => x.id === orgId) + 1;
}
export function worldRank(g: GameState, orgId: string) {
  return Object.values(g.orgs).filter(x => !x.disbanded).sort((a, b) => b.elo - a.elo).findIndex(x => x.id === orgId) + 1;
}
export function seriesLine(g: GameState, m: Match, me?: string) {
  const wa = m.games.filter(x => x.scoreA > x.scoreB).length, wb = m.games.length - wa;
  const meA = m.teamA === me;
  const won = m.winner === me;
  return { wa, wb, won, opp: g.orgs[meA ? m.teamB : m.teamA], my: meA ? wa : wb, their: meA ? wb : wa };
}

export function Dashboard() {
  const g = useGame();
  const nav = useStore(s => s.nav);
  if (!g.userOrgId) return <Unemployed />;
  const org = g.orgs[g.userOrgId];
  const order = (r: string | null) => (r === 'starter' ? 0 : r === 'sub' ? 1 : 2);
  const roster = orgPlayers(g, org.id).sort((a, b) => order(a.squadRole) - order(b.squadRole));
  const next = userNextMatch(g);
  const recent = Object.values(g.matches).filter(m => m.played && (m.teamA === org.id || m.teamB === org.id)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const f = forecastMonth(g, org);
  const upcoming = Object.values(g.tournaments).filter(t => t.status !== 'done' && (t.region === org.region || t.region === 'INTL')).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 5);
  const pts = g.circuitPoints[g.season]?.[org.id] ?? 0;
  const chem = teamChemistry(g, org, roster.filter(p => p.squadRole === 'starter').map(p => p.id));
  const balHist = g.monthly.filter(m => m.orgId === org.id).slice(-12);
  const unread = g.inbox.filter(i => !i.read).slice(0, 5);
  const risk = bankruptcyRisk(g, org);
  const inc = Object.values(f.income).reduce((a, b) => a + b, 0), exp = Object.values(f.expense).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-1 @5xl:grid-cols-3 gap-4">
      <div className="col-span-full"><Kpis>
        <div><Stat label={`Rang ${REGION_INFO[org.region].name}`} value={`#${regionRank(g, org.id)}`} sub={`#${worldRank(g, org.id)} mondial · Elo ${org.elo}`} tone="accent" /></div>
        <div><Stat label="Points circuit" value={pts} sub={`Saison ${g.season}`} /></div>
        <div><Stat label="Cohésion" value={`${Math.round(chem)}%`} sub="Titulaires" tone={chem > 60 ? 'good' : chem < 35 ? 'bad' : undefined} /></div>
        <div><Stat label="Confiance du board" value={`${Math.round(org.boardConfidence)}%`} sub={org.objective} tone={org.boardConfidence < 30 ? 'bad' : org.boardConfidence > 65 ? 'good' : undefined} /></div>
        <div><Stat label="Réputation" value={Math.round(org.reputation)} sub={`${org.trophies.length} trophée(s)`} /></div>
        <div><Stat label="Risque faillite" value={`${risk}%`} tone={risk > 40 ? 'bad' : 'good'} sub={org.debt ? `Dette ${money(org.debt)}` : 'Aucune dette'} /></div>
      </Kpis></div>

      <section className="card @5xl:col-span-2 relative overflow-hidden min-h-[230px]">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(520px 220px at 18% 55%, #3d8bff24, transparent 70%), radial-gradient(520px 220px at 82% 55%, #ff8a1f24, transparent 70%)' }} />
        <div className="relative p-5 h-full flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-300">Prochain match</span>
            {next && <Pill tone={g.tournaments[next.tournamentId].lan ? 'accent' : 'default'}>{g.tournaments[next.tournamentId].lan ? 'LAN' : 'En ligne'}</Pill>}
          </div>
          {next ? (() => {
            const opp = g.orgs[next.teamA === org.id ? next.teamB : next.teamA];
            const t = g.tournaments[next.tournamentId];
            const today = next.date <= g.date;
            return (
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex items-center justify-center gap-6 @3xl:gap-14 my-4">
                  <div className="flex flex-col items-center gap-2 min-w-0"><OrgBadge org={org} size={64} /><div className="font-bold text-center truncate max-w-44">{org.name}</div><div className="text-xs text-ink-400">Elo {org.elo}</div></div>
                  <div className="text-center"><div className="text-3xl font-black text-ink-500">VS</div><div className="text-xs text-ink-300 mt-1">Bo{next.bestOf}</div></div>
                  <div className="flex flex-col items-center gap-2 min-w-0"><OrgBadge org={opp} size={64} /><div className="font-bold text-center truncate max-w-44 link" onClick={() => nav('org', opp.id)}>{opp.name}</div><div className="text-xs text-ink-400">Elo {opp.elo}</div></div>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="text-sm"><span className="font-semibold">{t.short}</span> <span className="text-ink-400">· {next.label} · {fmtDate(next.date, true)}</span></div>
                  {today ? <Btn kind="primary" onClick={() => nav('match', next.id)}>Aller au match →</Btn> : <Btn onClick={() => nav('tournament', t.id)}>Voir la compétition</Btn>}
                </div>
              </div>
            );
          })() : <div className="flex-1 flex items-center justify-center text-ink-400 text-sm text-center">Aucun match programmé.{upcoming[0] ? ` Prochaine compétition : ${upcoming[0].short} (${fmtShortDate(upcoming[0].start)})` : ''}</div>}
        </div>
      </section>

      <Panel title="Finances" right={<span className="link" onClick={() => nav('finances')}>Détails →</span>}>
        <div className={cx('text-[28px] font-bold tnum leading-none', org.balance < 0 && 'text-bad')}>{money(org.balance)}</div>
        <div className={cx('text-sm mt-1.5 font-medium', f.net >= 0 ? 'text-good' : 'text-bad')}>{f.net >= 0 ? '+' : ''}{money(f.net)} / mois prévus</div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div className="rounded-lg bg-good/8 border border-good/20 p-2.5"><div className="text-[11px] text-ink-400">Revenus</div><div className="font-semibold text-good tnum">{money(inc)}</div></div>
          <div className="rounded-lg bg-bad/8 border border-bad/20 p-2.5"><div className="text-[11px] text-ink-400">Dépenses</div><div className="font-semibold text-bad tnum">{money(exp)}</div></div>
        </div>
        <div className="h-20 mt-3">
          {balHist.length > 1 ? (
            <ResponsiveContainer><AreaChart data={balHist}><XAxis dataKey="month" hide /><YAxis hide /><Tooltip contentStyle={{ background: '#171c27', border: '1px solid #313a4c', borderRadius: 8, fontSize: 12 }} formatter={(v) => money(Number(v))} /><Area dataKey="balance" stroke="#ff8a1f" strokeWidth={2} fill="#ff8a1f22" isAnimationActive={false} /></AreaChart></ResponsiveContainer>
          ) : <div className="text-xs text-ink-500 pt-6 text-center">Historique disponible après le premier mois</div>}
        </div>
      </Panel>

      <Panel title="Effectif" className="@5xl:col-span-2" pad={false} right={<span className="link" onClick={() => nav('squad')}>Gérer →</span>}>
        <table className="data">
          <thead><tr><th>Joueur</th><th>Statut</th><th>Niv.</th><th>Forme</th><th>Moral</th><th>Fatigue</th><th>Contrat</th></tr></thead>
          <tbody>
            {roster.map(p => (
              <tr key={p.id}>
                <td><div className="flex items-center gap-3"><Avatar p={p} org={org} size={32} /><div className="min-w-0"><PlayerLink p={p} /><div className="text-[11px] text-ink-400">{p.position}e homme · {p.playstyle}</div></div></div></td>
                <td>{p.squadRole === 'starter' ? <Pill tone="accent">Titulaire</Pill> : p.squadRole === 'sub' ? <Pill>Remplaçant</Pill> : <Pill tone="info">Académie</Pill>}</td>
                <td><AbilityCell g={g} p={p} /></td>
                <td className="tnum text-ink-200">{recentForm(p) ? recentForm(p).toFixed(1) : '—'}</td>
                <td><Pill tone={moraleTone(p.cond.morale)}>{moraleLabel(p.cond.morale)}</Pill></td>
                <td className="w-32"><div className="flex items-center gap-2"><CondDot p={p} /><Bar value={p.cond.fatigue} color={p.cond.fatigue > 70 ? '#f87171' : p.cond.fatigue > 45 ? '#facc15' : '#34d399'} /></div></td>
                <td className="text-ink-300 text-xs">{p.contract ? `${fmtShortDate(p.contract.end)} ${p.contract.end.slice(0, 4)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!roster.length && <Empty>Aucun joueur sous contrat. Recrutez depuis la Base joueurs.</Empty>}
      </Panel>

      <Panel title="Messagerie" pad={false} right={<span className="link" onClick={() => nav('inbox')}>Tout voir →</span>}>
        {unread.length ? unread.map(i => (
          <div key={i.id} className="px-4 py-3 border-b border-ink-700/60 hover:bg-ink-800/60 cursor-pointer flex gap-3" onClick={() => nav('inbox')}>
            <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
            <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><span className="font-semibold text-[13px] truncate">{i.title}</span><span className="text-[11px] text-ink-400 shrink-0">{fmtShortDate(i.date)}</span></div>
            <div className="text-xs text-ink-300 line-clamp-2 mt-0.5">{i.body}</div></div>
          </div>
        )) : <Empty>Aucun message non lu.</Empty>}
      </Panel>

      <Panel title="Résultats récents" pad={false}>
        {recent.length ? recent.map(m => { const s = seriesLine(g, m, org.id); return (
          <div key={m.id} className="px-4 py-2.5 border-b border-ink-700/60 flex items-center gap-3 cursor-pointer hover:bg-ink-800/60" onClick={() => nav('match', m.id)}>
            <span className={cx('w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0', s.won ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad')}>{s.won ? 'V' : 'D'}</span>
            <span className="tnum font-bold w-9 shrink-0">{s.my}-{s.their}</span>
            <span className="flex-1 min-w-0"><OrgLink org={s.opp} /></span>
            <span className="text-[11px] text-ink-400 truncate">{g.tournaments[m.tournamentId].short}</span>
          </div>); }) : <Empty>Pas encore de match joué.</Empty>}
      </Panel>

      <Panel title="Calendrier" pad={false} right={<span className="link" onClick={() => nav('schedule')}>Voir →</span>}>
        {upcoming.map(t => (
          <div key={t.id} className="px-4 py-2.5 border-b border-ink-700/60 flex items-center gap-3 cursor-pointer hover:bg-ink-800/60" onClick={() => nav('tournament', t.id)}>
            <div className="w-11 text-center rounded-lg bg-ink-800 border border-ink-600 py-1 leading-tight shrink-0"><div className="text-[10px] uppercase text-ink-400">{fmtShortDate(t.start).split(' ')[1]}</div><div className="font-bold">{fmtShortDate(t.start).split(' ')[0]}</div></div>
            <div className="flex-1 min-w-0"><div className="font-medium truncate">{t.short}</div><div className="text-[11px] text-ink-400">{t.status === 'live' ? 'En cours' : t.kind !== 'regional' ? 'Sur qualification' : 'Inscrit'}</div></div>
            {t.lan ? <Pill tone="accent">LAN</Pill> : <Pill>Online</Pill>}
          </div>
        ))}
      </Panel>

      <Panel title="Actualités" pad={false} right={<span className="link" onClick={() => nav('news')}>Toutes →</span>}>
        {g.news.slice(0, 6).map(n => (
          <div key={n.id} className="px-4 py-2.5 border-b border-ink-700/60">
            <div className={cx('text-[13px] font-medium line-clamp-2', n.important && 'text-accent')}>{n.kind === 'rumor' && <Pill tone="warn">Rumeur</Pill>} {n.title}</div>
            <div className="text-[11px] text-ink-400 mt-0.5">{fmtShortDate(n.date)}</div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function Unemployed() {
  const g = useGame();
  const notify = useStore(s => s.notify);
  const vs = vacancies(g);
  return (
    <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
      <Panel title="Postes vacants" pad={false}>
        {vs.length ? (
          <table className="data"><thead><tr><th>Organisation</th><th>Région</th><th>Réputation</th><th></th></tr></thead><tbody>
            {vs.map(o => { const app = g.manager.applications.find(a => a.orgId === o.id && a.status === 'pending'); return (
              <tr key={o.id}><td><OrgLink org={o} /></td><td>{REGION_INFO[o.region].name}</td><td className="tnum">{Math.round(o.reputation)}</td>
                <td className="text-right">{app ? <Pill tone="info">En attente</Pill> : <Btn small kind="primary" onClick={() => notify(act(gs => applyForJob(gs, o.id)))}>Postuler</Btn>}</td></tr>); })}
          </tbody></table>
        ) : <Empty>Aucun poste vacant pour le moment. Avancez dans le temps.</Empty>}
      </Panel>
      <Panel title="Votre profil">
        <div className="grid grid-cols-1 @4xl:grid-cols-3 gap-4">
          <Stat label="Réputation" value={Math.round(g.manager.reputation)} />
          <Stat label="Expérience" value={`${g.manager.experience} saison(s)`} />
          <Stat label="Trophées" value={g.manager.trophies.length} />
        </div>
        <div className="mt-4 text-xs text-ink-300">Candidatures : {g.manager.applications.map(a => `${g.orgs[a.orgId]?.name} (${a.status === 'pending' ? 'en attente' : a.status === 'accepted' ? 'acceptée' : 'refusée'})`).join(', ') || 'aucune'}</div>
      </Panel>
      <Panel title="Actualités" className="@3xl:col-span-2" pad={false}>
        {g.news.slice(0, 12).map(n => <div key={n.id} className="px-3 py-1.5 border-b border-ink-800"><span className="text-ink-400 text-[11px] mr-3">{fmtShortDate(n.date)}</span>{n.title}</div>)}
      </Panel>
    </div>
  );
}

export function Inbox() {
  const g = useGame();
  const { nav, notify } = useStore();
  return (
    <div className="">
      <Panel title={`Messagerie (${g.inbox.filter(i => !i.read).length} non lus)`} pad={false} right={<span className="link" onClick={() => act(gs => gs.inbox.forEach(i => (i.read = true)))}>Tout marquer comme lu</span>}>
        {!g.inbox.length && <Empty>Aucun message.</Empty>}
        {g.inbox.map(i => {
          const offer = i.action?.kind === 'offer' ? g.offers[i.action.id] : null;
          return (
            <div key={i.id} className={cx('px-4 py-3 border-b border-ink-800', !i.read && 'bg-ink-850')} onClick={() => { if (!i.read) act(() => { i.read = true; }, { save: false }); }}>
              <div className="flex items-center gap-3">
                {!i.read && <span className="w-1.5 h-1.5 bg-accent rounded-full" />}
                <span className="font-semibold flex-1">{i.title}</span>
                <span className="text-[11px] text-ink-400">{fmtDate(i.date)}</span>
              </div>
              <div className="text-ink-300 mt-1 text-xs">{i.body}</div>
              <div className="flex gap-2 mt-2">
                {offer && offer.status === 'pending' && <>
                  <Btn small kind="primary" onClick={() => notify(act(gs => respondIncoming(gs, offer.id, true)), 'good')}>Accepter l'offre</Btn>
                  <Btn small kind="danger" onClick={() => notify(act(gs => respondIncoming(gs, offer.id, false)))}>Refuser</Btn>
                  <Btn small onClick={() => nav('player', offer.playerId)}>Voir le joueur</Btn>
                </>}
                {offer && offer.status !== 'pending' && <Pill>{offer.status === 'completed' ? 'Transfert effectué' : offer.status === 'rejected' ? 'Refusée' : 'Expirée'}</Pill>}
                {i.action?.kind === 'screen' && <Btn small onClick={() => { const [s, id] = i.action!.id.split(':'); nav(s as never, id); }}>Ouvrir</Btn>}
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
