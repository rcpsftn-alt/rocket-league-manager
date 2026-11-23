import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGame, useStore, act } from '../store';
import { Btn, CondDot, cx, Empty, moraleLabel, moraleTone, OrgLink, Panel, Pill, PlayerLink, Stat, AbilityCell } from '../components/ui';
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
  const roster = orgPlayers(g, org.id).sort((a, b) => (a.squadRole === 'starter' ? 0 : a.squadRole === 'sub' ? 1 : 2) - (b.squadRole === 'starter' ? 0 : b.squadRole === 'sub' ? 1 : 2));
  const next = userNextMatch(g);
  const recent = Object.values(g.matches).filter(m => m.played && (m.teamA === org.id || m.teamB === org.id)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const f = forecastMonth(g, org);
  const upcoming = Object.values(g.tournaments).filter(t => t.status !== 'done' && (t.region === org.region || t.region === 'INTL')).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 5);
  const pts = g.circuitPoints[g.season]?.[org.id] ?? 0;
  const chem = teamChemistry(g, org, roster.filter(p => p.squadRole === 'starter').map(p => p.id));
  const balHist = g.monthly.filter(m => m.orgId === org.id).slice(-12);
  const unread = g.inbox.filter(i => !i.read).slice(0, 6);

  return (
    <div className="p-3 grid grid-cols-12 gap-3 auto-rows-min">
      <Panel className="col-span-12" pad={false}>
        <div className="grid grid-cols-7 divide-x divide-ink-700">
          {[
            <Stat key="r" label={`Rang ${REGION_INFO[org.region].name}`} value={`#${regionRank(g, org.id)}`} sub={`Mondial #${worldRank(g, org.id)} · Elo ${org.elo}`} tone="accent" />,
            <Stat key="p" label="Points circuit" value={pts} sub={`Saison ${g.season}`} />,
            <Stat key="b" label="Trésorerie" value={money(org.balance)} sub={`Prévision ${f.net >= 0 ? '+' : ''}${money(f.net)}/mois`} tone={org.balance < 0 ? 'bad' : undefined} />,
            <Stat key="c" label="Cohésion" value={`${Math.round(chem)}%`} sub="Titulaires" tone={chem > 60 ? 'good' : chem < 35 ? 'bad' : undefined} />,
            <Stat key="bo" label="Board" value={`${Math.round(org.boardConfidence)}%`} sub={org.objective} tone={org.boardConfidence < 30 ? 'bad' : org.boardConfidence > 65 ? 'good' : undefined} />,
            <Stat key="rep" label="Réputation" value={Math.round(org.reputation)} sub={`${org.trophies.length} trophée(s)`} />,
            <Stat key="risk" label="Risque faillite" value={`${bankruptcyRisk(g, org)}%`} tone={bankruptcyRisk(g, org) > 40 ? 'bad' : 'good'} sub={org.debt ? `Dette ${money(org.debt)}` : 'Aucune dette'} />,
          ].map((x, i) => <div key={i} className="p-3">{x}</div>)}
        </div>
      </Panel>

      <Panel title="Prochain match" className="col-span-4">
        {next ? (() => {
          const opp = g.orgs[next.teamA === org.id ? next.teamB : next.teamA];
          const t = g.tournaments[next.tournamentId];
          return (
            <div className="flex flex-col gap-3">
              <div className="text-[11px] text-ink-300">{t.short} · {next.label} · Bo{next.bestOf}</div>
              <div className="flex items-center justify-between">
                <OrgLink org={org} />
                <span className="text-ink-400 text-xs">vs</span>
                <OrgLink org={opp} />
              </div>
              <div className="flex items-center justify-between text-xs text-ink-300">
                <span>{fmtDate(next.date, true)}</span>
                <span>Elo {org.elo} – {opp.elo}</span>
              </div>
              {next.date <= g.date ? <Btn kind="primary" onClick={() => nav('match', next.id)}>Aller au match</Btn> : <Btn onClick={() => nav('tournament', t.id)}>Voir la compétition</Btn>}
            </div>
          );
        })() : <Empty>Aucun match programmé. {upcoming[0] ? `Prochaine compétition : ${upcoming[0].short} (${fmtShortDate(upcoming[0].start)})` : ''}</Empty>}
      </Panel>

      <Panel title="Résultats récents" className="col-span-4" pad={false}>
        {recent.length ? (
          <table className="data"><tbody>
            {recent.map(m => { const s = seriesLine(g, m, org.id); return (
              <tr key={m.id} className="cursor-pointer" onClick={() => nav('match', m.id)}>
                <td className="w-6"><span className={cx('font-bold', s.won ? 'text-good' : 'text-bad')}>{s.won ? 'V' : 'D'}</span></td>
                <td className="tnum font-semibold">{s.my}-{s.their}</td>
                <td><OrgLink org={s.opp} /></td>
                <td className="text-ink-400 text-[11px]">{g.tournaments[m.tournamentId].short}</td>
              </tr>); })}
          </tbody></table>
        ) : <Empty>Pas encore de match joué.</Empty>}
      </Panel>

      <Panel title="Finances" className="col-span-4" right={<span className="link" onClick={() => nav('finances')}>Détails</span>}>
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div className="text-ink-300">Revenus prévus</div><div className="text-right tnum text-good">{money(Object.values(f.income).reduce((a, b) => a + b, 0))}</div>
          <div className="text-ink-300">Dépenses prévues</div><div className="text-right tnum text-bad">-{money(Object.values(f.expense).reduce((a, b) => a + b, 0))}</div>
        </div>
        <div className="h-24">
          {balHist.length > 1 ? (
            <ResponsiveContainer><AreaChart data={balHist}><XAxis dataKey="month" hide /><YAxis hide /><Tooltip contentStyle={{ background: '#15181c', border: '1px solid #2e333b', fontSize: 11 }} formatter={(v) => money(Number(v))} /><Area dataKey="balance" stroke="#ff7a1a" fill="#ff7a1a22" isAnimationActive={false} /></AreaChart></ResponsiveContainer>
          ) : <Empty>L'historique apparaîtra après le premier mois.</Empty>}
        </div>
      </Panel>

      <Panel title="Effectif" className="col-span-7" pad={false} right={<span className="link" onClick={() => nav('squad')}>Gérer</span>}>
        <table className="data">
          <thead><tr><th></th><th>Joueur</th><th>Rôle</th><th>Niv.</th><th>Forme</th><th>Moral</th><th>Fatigue</th><th>Contrat</th></tr></thead>
          <tbody>
            {roster.map(p => (
              <tr key={p.id}>
                <td><CondDot p={p} /></td>
                <td><PlayerLink p={p} /></td>
                <td className="text-ink-300">{p.squadRole === 'starter' ? 'Titulaire' : p.squadRole === 'sub' ? 'Remplaçant' : 'Académie'}</td>
                <td><AbilityCell g={g} p={p} /></td>
                <td className="tnum">{recentForm(p) ? recentForm(p).toFixed(1) : '—'}</td>
                <td><Pill tone={moraleTone(p.cond.morale)}>{moraleLabel(p.cond.morale)}</Pill></td>
                <td className="tnum">{Math.round(p.cond.fatigue)}%</td>
                <td className="text-ink-300 text-[11px]">{p.contract ? fmtShortDate(p.contract.end) + ' ' + p.contract.end.slice(0, 4) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Messagerie" className="col-span-5" pad={false} right={<span className="link" onClick={() => nav('inbox')}>Tout voir</span>}>
        {unread.length ? unread.map(i => (
          <div key={i.id} className="px-3 py-2 border-b border-ink-800 hover:bg-ink-850 cursor-pointer" onClick={() => nav('inbox')}>
            <div className="flex justify-between"><span className="font-medium">{i.title}</span><span className="text-[10px] text-ink-400">{fmtShortDate(i.date)}</span></div>
            <div className="text-[11px] text-ink-300 truncate">{i.body}</div>
          </div>
        )) : <Empty>Aucun message non lu.</Empty>}
      </Panel>

      <Panel title="Calendrier" className="col-span-5" pad={false}>
        <table className="data"><tbody>
          {upcoming.map(t => (
            <tr key={t.id} className="cursor-pointer" onClick={() => nav('tournament', t.id)}>
              <td className="text-ink-300 w-20">{fmtShortDate(t.start)}</td>
              <td>{t.short}</td>
              <td>{t.lan ? <Pill tone="accent">LAN</Pill> : <Pill>Online</Pill>}</td>
              <td className="text-right">{t.status === 'live' ? <Pill tone="good">En cours</Pill> : t.kind !== 'regional' ? <span className="text-[11px] text-ink-400">Sur qualification</span> : ''}</td>
            </tr>
          ))}
        </tbody></table>
      </Panel>

      <Panel title="Actualités" className="col-span-7" pad={false} right={<span className="link" onClick={() => nav('news')}>Toutes</span>}>
        {g.news.slice(0, 7).map(n => (
          <div key={n.id} className="px-3 py-1.5 border-b border-ink-800 flex gap-3">
            <span className="text-[10px] text-ink-400 w-12 shrink-0 pt-0.5">{fmtShortDate(n.date)}</span>
            <div className="min-w-0"><div className={cx('truncate', n.important && 'text-accent')}>{n.kind === 'rumor' ? '⚑ ' : ''}{n.title}</div></div>
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
    <div className="p-3 grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Réputation" value={Math.round(g.manager.reputation)} />
          <Stat label="Expérience" value={`${g.manager.experience} saison(s)`} />
          <Stat label="Trophées" value={g.manager.trophies.length} />
        </div>
        <div className="mt-4 text-xs text-ink-300">Candidatures : {g.manager.applications.map(a => `${g.orgs[a.orgId]?.name} (${a.status === 'pending' ? 'en attente' : a.status === 'accepted' ? 'acceptée' : 'refusée'})`).join(', ') || 'aucune'}</div>
      </Panel>
      <Panel title="Actualités" className="col-span-2" pad={false}>
        {g.news.slice(0, 12).map(n => <div key={n.id} className="px-3 py-1.5 border-b border-ink-800"><span className="text-ink-400 text-[11px] mr-3">{fmtShortDate(n.date)}</span>{n.title}</div>)}
      </Panel>
    </div>
  );
}

export function Inbox() {
  const g = useGame();
  const { nav, notify } = useStore();
  return (
    <div className="p-3">
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
