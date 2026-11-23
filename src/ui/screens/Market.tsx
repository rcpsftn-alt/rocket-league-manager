import { useMemo, useState } from 'react';
import { useGame, useStore, act } from '../store';
import type { Player, Region } from '../../engine/types';
import { REGIONS, PLAYSTYLES } from '../../engine/types';
import { AbilityCell, Btn, cx, Empty, Field, OrgLink, Panel, Pill, PlayerLink, PotCell, Stat, Tabs, useSort } from '../components/ui';
import { age, askingFee, avgRating, ca, fuzzy, knowledge, potentialStars } from '../../engine/player';
import { REGION_INFO } from '../../engine/data';
import { fmtShortDate, money } from '../../engine/util';
import { respondIncoming, transferWindowOpen, windowLabel } from '../../engine/transfers';
import { staffOf } from '../../engine/staff';

const PAGE = 60;

export function PlayerTable({ rows, extra }: { rows: Player[]; extra?: (p: Player) => React.ReactNode }) {
  const g = useGame();
  const [page, setPage] = useState(0);
  const { sorted, th } = useSort(rows, { key: 'ca', dir: -1 }, {
    tag: p => p.tag.toLowerCase(), age: p => age(g, p), ca: p => { const [lo, hi] = fuzzy(g, p, ca(p)); return (lo + hi) / 2; }, pot: p => potentialStars(g, p) ?? 0,
    val: p => p.value, rat: p => avgRating(p.season), sal: p => p.contract?.salary ?? 0, rep: p => p.reputation, k: p => knowledge(g, p),
  });
  const view = sorted.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <>
      <table className="data">
        <thead><tr>{th('tag', 'Joueur')}<th>Organisation</th><th>Rég.</th>{th('age', 'Âge')}<th>Poste</th><th>Style</th>{th('ca', 'Niveau')}{th('pot', 'Potentiel')}{th('rat', 'Note saison')}{th('val', 'Valeur')}{th('sal', 'Salaire')}<th>Contrat</th>{th('k', 'Connu')}{extra && <th></th>}</tr></thead>
        <tbody>
          {view.map(p => (
            <tr key={p.id} className={cx(p.orgId === g.userOrgId && 'me')}>
              <td><PlayerLink p={p} /></td>
              <td>{p.orgId ? <OrgLink org={g.orgs[p.orgId]} /> : <Pill tone="info">Libre</Pill>}</td>
              <td className="text-ink-300">{p.region}</td>
              <td className="tnum">{age(g, p)}</td>
              <td className="tnum">{p.position}e</td>
              <td className="text-ink-300">{p.playstyle}</td>
              <td><AbilityCell g={g} p={p} /></td>
              <td><PotCell g={g} p={p} /></td>
              <td className="tnum">{avgRating(p.season) ? avgRating(p.season).toFixed(2) : '—'}</td>
              <td className="tnum">{money(p.value)}</td>
              <td className="tnum">{p.contract ? money(p.contract.salary) : '—'}</td>
              <td className="text-[11px] text-ink-300">{p.contract ? p.contract.end.slice(0, 4) : '—'}</td>
              <td className="tnum text-ink-300">{Math.round(knowledge(g, p))}%</td>
              {extra && <td className="text-right">{extra(p)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty>Aucun joueur ne correspond.</Empty>}
      {sorted.length > PAGE && (
        <div className="flex items-center gap-2 p-2 text-xs text-ink-300">
          <Btn small disabled={page === 0} onClick={() => setPage(page - 1)}>‹</Btn>
          Page {page + 1} / {Math.ceil(sorted.length / PAGE)} · {sorted.length} joueurs
          <Btn small disabled={(page + 1) * PAGE >= sorted.length} onClick={() => setPage(page + 1)}>›</Btn>
        </div>
      )}
    </>
  );
}

export function Database() {
  const g = useGame();
  const userRegion = g.userOrgId ? g.orgs[g.userOrgId].region : 'EU';
  const [q, setQ] = useState('');
  const [region, setRegion] = useState<Region | 'ALL'>(userRegion);
  const [status, setStatus] = useState<'all' | 'free' | 'contract' | 'listed' | 'expiring'>('all');
  const [minAge, setMinAge] = useState(15), [maxAge, setMaxAge] = useState(35);
  const [minCa, setMinCa] = useState(0);
  const [minPot, setMinPot] = useState(0);
  const [pos, setPos] = useState(0);
  const [style, setStyle] = useState('');
  const [maxVal, setMaxVal] = useState(0);
  const rows = useMemo(() => Object.values(g.players).filter(p => {
    if (p.retired) return false;
    if (q && !(`${p.tag} ${p.firstName} ${p.lastName}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (region !== 'ALL' && p.region !== region) return false;
    const a = age(g, p);
    if (a < minAge || a > maxAge) return false;
    if (status === 'free' && p.orgId) return false;
    if (status === 'contract' && !p.orgId) return false;
    if (status === 'listed' && !p.askingOffer) return false;
    if (status === 'expiring' && !(p.contract && p.contract.end.slice(0, 4) === String(g.season))) return false;
    if (minCa) { const [lo, hi] = fuzzy(g, p, ca(p)); if ((lo + hi) / 2 < minCa) return false; }
    if (minPot && (potentialStars(g, p) ?? 0) < minPot) return false;
    if (pos && p.position !== pos) return false;
    if (style && p.playstyle !== style) return false;
    if (maxVal && askingFee(g, p) > maxVal) return false;
    return true;
  }), [g, q, region, status, minAge, maxAge, minCa, minPot, pos, style, maxVal, useStore.getState().v]);
  return (
    <div className="p-3 flex flex-col gap-3">
      <Panel title="Recherche avancée">
        <div className="grid grid-cols-10 gap-3 items-end">
          <Field label="Nom / tag"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" /></Field>
          <Field label="Région"><select value={region} onChange={e => setRegion(e.target.value as Region | 'ALL')}><option value="ALL">Toutes</option>{REGIONS.map(r => <option key={r} value={r}>{REGION_INFO[r].name}</option>)}</select></Field>
          <Field label="Statut"><select value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="all">Tous</option><option value="free">Agents libres</option><option value="contract">Sous contrat</option><option value="listed">Transférables</option><option value="expiring">Fin de contrat</option></select></Field>
          <Field label={`Âge ${minAge}-${maxAge}`}><div className="flex gap-1"><input type="number" value={minAge} onChange={e => setMinAge(+e.target.value)} className="w-full" /><input type="number" value={maxAge} onChange={e => setMaxAge(+e.target.value)} className="w-full" /></div></Field>
          <Field label="Niveau min."><input type="number" value={minCa} onChange={e => setMinCa(+e.target.value)} /></Field>
          <Field label="Potentiel min. ★"><select value={minPot} onChange={e => setMinPot(+e.target.value)}>{[0, 2, 3, 3.5, 4, 4.5].map(v => <option key={v} value={v}>{v || '—'}</option>)}</select></Field>
          <Field label="Poste"><select value={pos} onChange={e => setPos(+e.target.value)}><option value={0}>Tous</option><option value={1}>1er homme</option><option value={2}>2e homme</option><option value={3}>3e homme</option></select></Field>
          <Field label="Style"><select value={style} onChange={e => setStyle(e.target.value)}><option value="">Tous</option>{PLAYSTYLES.map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Indemnité max."><input type="number" value={maxVal || ''} placeholder="∞" onChange={e => setMaxVal(+e.target.value)} /></Field>
          <div className="text-[11px] text-ink-400">Les niveaux affichés en fourchette dépendent de votre connaissance (scouting).</div>
        </div>
      </Panel>
      <Panel title={`${rows.length} joueurs`} pad={false}><PlayerTable rows={rows} /></Panel>
    </div>
  );
}

export function Transfers() {
  const g = useGame();
  const { notify } = useStore();
  const [tab, setTab] = useState<'Offres reçues' | 'Mes offres' | 'Shortlist' | 'Journal des transferts'>('Offres reçues');
  const org = g.orgs[g.userOrgId!];
  const incoming = Object.values(g.offers).filter(o => o.incoming && o.toOrgId === org.id).sort((a, b) => b.date.localeCompare(a.date));
  const mine = Object.values(g.offers).filter(o => !o.incoming && o.fromOrgId === org.id).sort((a, b) => b.date.localeCompare(a.date));
  const spentSeason = g.transfersLog.filter(t => t.to === org.name && t.date.startsWith(String(g.season))).reduce((a, t) => a + t.fee, 0);
  const soldSeason = g.transfersLog.filter(t => t.from === org.name && t.date.startsWith(String(g.season))).reduce((a, t) => a + t.fee, 0);
  const st = (s: string) => s === 'pending' ? <Pill tone="info">En attente</Pill> : s === 'accepted' ? <Pill tone="good">Acceptée</Pill> : s === 'completed' ? <Pill tone="good">Finalisé</Pill> : s === 'rejected' ? <Pill tone="bad">Refusée</Pill> : <Pill>Expirée</Pill>;
  return (
    <div className="p-3 flex flex-col gap-3">
      <Panel pad={false}>
        <div className="grid grid-cols-4 divide-x divide-ink-700">
          <div className="p-3"><Stat label="Fenêtre" value={<span className={transferWindowOpen(g) ? 'text-good' : 'text-ink-300'}>{transferWindowOpen(g) ? 'Ouverte' : 'Fermée'}</span>} sub={windowLabel(g)} /></div>
          <div className="p-3"><Stat label="Budget disponible" value={money(org.balance)} /></div>
          <div className="p-3"><Stat label="Dépenses saison" value={money(spentSeason)} /></div>
          <div className="p-3"><Stat label="Ventes saison" value={money(soldSeason)} /></div>
        </div>
      </Panel>
      <Panel pad={false}>
        <Tabs tabs={['Offres reçues', 'Mes offres', 'Shortlist', 'Journal des transferts'] as const} value={tab} onChange={setTab} />
        {tab === 'Offres reçues' && (incoming.length ? (
          <table className="data"><thead><tr><th>Date</th><th>Joueur</th><th>Club acheteur</th><th>Indemnité</th><th>Valeur</th><th>Expire</th><th>Statut</th><th></th></tr></thead><tbody>
            {incoming.map(o => (
              <tr key={o.id}><td>{fmtShortDate(o.date)}</td><td><PlayerLink p={g.players[o.playerId]} /></td><td><OrgLink org={g.orgs[o.fromOrgId]} /></td><td className="tnum font-semibold">{money(o.fee)}</td><td className="tnum text-ink-300">{money(g.players[o.playerId]?.value ?? 0)}</td><td>{fmtShortDate(o.expires)}</td><td>{st(o.status)}</td>
                <td className="text-right">{o.status === 'pending' && <span className="flex gap-1 justify-end"><Btn small kind="primary" onClick={() => notify(act(gs => respondIncoming(gs, o.id, true)), 'good')}>Accepter</Btn><Btn small kind="danger" onClick={() => notify(act(gs => respondIncoming(gs, o.id, false)))}>Refuser</Btn></span>}</td></tr>
            ))}
          </tbody></table>) : <Empty>Aucune offre reçue. Les clubs IA font des offres pendant les fenêtres de transfert.</Empty>)}
        {tab === 'Mes offres' && (mine.length ? (
          <table className="data"><thead><tr><th>Date</th><th>Joueur</th><th>Club</th><th>Indemnité</th><th>Contre-offre</th><th>Statut</th></tr></thead><tbody>
            {mine.map(o => <tr key={o.id}><td>{fmtShortDate(o.date)}</td><td><PlayerLink p={g.players[o.playerId]} /></td><td>{o.toOrgId ? <OrgLink org={g.orgs[o.toOrgId]} /> : 'Libre'}</td><td className="tnum">{money(o.fee)}</td><td className="tnum">{o.counterFee ? money(o.counterFee) : '—'}</td><td>{st(o.status)}</td></tr>)}
          </tbody></table>) : <Empty>Aucune offre envoyée. Ouvrez une fiche joueur pour faire une offre.</Empty>)}
        {tab === 'Shortlist' && <PlayerTable rows={g.shortlist.map(id => g.players[id]).filter(Boolean)} extra={p => <Btn small kind="ghost" onClick={() => act(gs => { gs.shortlist = gs.shortlist.filter(x => x !== p.id); })}>Retirer</Btn>} />}
        {tab === 'Journal des transferts' && (
          <table className="data"><thead><tr><th>Date</th><th>Joueur</th><th>De</th><th>Vers</th><th>Indemnité</th></tr></thead><tbody>
            {g.transfersLog.slice(0, 200).map((t, i) => <tr key={i} className={cx((t.to === org.name || t.from === org.name) && 'me')}><td>{fmtShortDate(t.date)} {t.date.slice(0, 4)}</td><td><PlayerLink p={g.players[t.playerId]} /></td><td className="text-ink-300">{t.from}</td><td>{t.to}</td><td className="tnum">{t.fee ? money(t.fee) : 'Libre'}</td></tr>)}
          </tbody></table>
        )}
      </Panel>
    </div>
  );
}

export function Scouting() {
  const g = useGame();
  const nav = useStore(s => s.nav);
  const org = g.orgs[g.userOrgId!];
  const scouts = staffOf(g, org.id).filter(s => s.role === 'Recruteur' || s.role === 'Analyste');
  const knownByRegion = REGIONS.map(r => { const ps = Object.values(g.players).filter(p => p.region === r && !p.retired); return { r, pct: ps.length ? ps.reduce((a, p) => a + knowledge(g, p), 0) / ps.length : 0 }; });
  const prospects = Object.values(g.players).filter(p => !p.retired && age(g, p) <= 19 && knowledge(g, p) >= 45 && (potentialStars(g, p) ?? 0) >= 3.5 && p.orgId !== org.id);
  return (
    <div className="p-3 grid grid-cols-3 gap-3">
      <Panel title="Recruteurs & analystes" className="col-span-1" pad={false}>
        {!scouts.length && <Empty>Aucun recruteur. Engagez-en un depuis l'écran Staff pour découvrir les attributs et le potentiel des joueurs.</Empty>}
        {scouts.map(s => (
          <div key={s.id} className="px-3 py-2 border-b border-ink-800">
            <div className="flex justify-between"><span className="font-medium">{s.name}</span><span className="text-[11px] text-ink-300">{s.role} · analyse {s.attrs.analysis}/20</span></div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-ink-400">Mission :</span>
              <select value={s.scoutRegion ?? ''} onChange={e => act(() => { s.scoutRegion = (e.target.value || null) as Region | null; })}>
                <option value="">{s.role === 'Recruteur' ? `Région du club (${org.region})` : 'Aucune (analyse de match)'}</option>
                {REGIONS.map(r => <option key={r} value={r}>{REGION_INFO[r].name}</option>)}
              </select>
            </div>
          </div>
        ))}
        <div className="px-3 py-2 text-[11px] text-ink-400">Chaque jour, les recruteurs observent {`1 + analyse/5`} joueurs de leur région. Jouer contre une équipe révèle aussi ses joueurs.</div>
      </Panel>
      <Panel title="Connaissance du monde" pad={false}>
        <table className="data"><tbody>{knownByRegion.map(k => <tr key={k.r}><td>{REGION_INFO[k.r].name}</td><td className="w-40"><div className="w-full h-1.5 bg-ink-700"><div className="h-1.5 bg-accent" style={{ width: `${k.pct}%` }} /></div></td><td className="tnum text-right">{Math.round(k.pct)}%</td></tr>)}</tbody></table>
      </Panel>
      <Panel title="Rapports" pad={false}>
        <div className="p-3 text-xs text-ink-300">Joueurs connus à plus de 90% : <b className="text-white">{Object.values(g.players).filter(p => knowledge(g, p) >= 90 && p.orgId !== org.id).length}</b><br />Pépites identifiées (≤19 ans, ★3.5+) : <b className="text-accent">{prospects.length}</b></div>
      </Panel>
      <Panel title="Pépites repérées" className="col-span-3" pad={false}><PlayerTable rows={prospects} extra={p => <Btn small onClick={() => nav('player', p.id)}>Fiche</Btn>} /></Panel>
    </div>
  );
}
