import { useState } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGame, useStore, act } from '../store';
import type { FinanceCategory } from '../../engine/types';
import { INCOME_CATS } from '../../engine/types';
import { Btn, cx, Empty, Field, Modal, Panel, Pill, Stat, Tabs, Bar, OrgLink } from '../components/ui';
import { fmtDate, fmtShortDate, money, num } from '../../engine/util';
import { ACADEMY_COST, bankruptcyRisk, FACILITY_COST, forecastMonth, summarize, totalFollowers, activeDeals } from '../../engine/finance';
import { CAMPAIGNS, proposeSponsorDeal, runCampaign, sponsorInterest, sponsorValuation, terminateDeal, type CampaignKind, type SponsorProposal } from '../../engine/commercial';
import { book } from '../../engine/ledger';
import { vacancies, applyForJob } from '../../engine/ai';
import { REGION_INFO } from '../../engine/data';

const tt = { contentStyle: { background: '#15181c', border: '1px solid #2e333b', fontSize: 11 }, formatter: (v: unknown) => money(Number(v)) };

export function Finances() {
  const g = useGame();
  const org = g.orgs[g.userOrgId!];
  const [tab, setTab] = useState<'Vue d\'ensemble' | 'Compte de résultat' | 'Journal'>('Vue d\'ensemble');
  const f = forecastMonth(g, org);
  const season = summarize(g, org.id, `${g.season}-01-01`);
  const monthly = g.monthly.filter(m => m.orgId === org.id).slice(-24);
  const risk = bankruptcyRisk(g, org);
  const runway = f.net < 0 ? org.balance / -f.net : Infinity;
  return (
    <div className="p-3 flex flex-col gap-3">
      <Panel pad={false}>
        <div className="grid grid-cols-6 divide-x divide-ink-700">
          <div className="p-3"><Stat label="Trésorerie" value={money(org.balance)} tone={org.balance < 0 ? 'bad' : undefined} /></div>
          <div className="p-3"><Stat label="Résultat mensuel prévu" value={`${f.net >= 0 ? '+' : ''}${money(f.net)}`} tone={f.net >= 0 ? 'good' : 'bad'} /></div>
          <div className="p-3"><Stat label="Résultat saison" value={money(season.income + season.expense)} sub={`+${money(season.income)} / ${money(season.expense)}`} /></div>
          <div className="p-3"><Stat label="Dette" value={money(org.debt)} sub={org.debt ? 'Intérêts 0,8%/mois' : 'Ligne de crédit auto. si trésorerie < 0'} tone={org.debt ? 'bad' : undefined} /></div>
          <div className="p-3"><Stat label="Autonomie" value={runway === Infinity ? '∞' : `${runway.toFixed(1)} mois`} /></div>
          <div className="p-3"><Stat label="Risque de faillite" value={`${risk}%`} tone={risk > 40 ? 'bad' : risk > 15 ? undefined : 'good'} /></div>
        </div>
      </Panel>
      <Tabs tabs={['Vue d\'ensemble', 'Compte de résultat', 'Journal'] as const} value={tab} onChange={setTab} />
      {tab === 'Vue d\'ensemble' && (
        <div className="grid grid-cols-3 gap-3">
          <Panel title="Budget mensuel prévisionnel" pad={false}>
            <table className="data"><tbody>
              {Object.entries(f.income).map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right tnum text-good">+{money(v)}</td></tr>)}
              {Object.entries(f.expense).map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right tnum text-bad">-{money(v)}</td></tr>)}
              <tr><td className="font-bold">Solde</td><td className={cx('text-right tnum font-bold', f.net >= 0 ? 'text-good' : 'text-bad')}>{money(f.net)}</td></tr>
            </tbody></table>
            <div className="p-3 text-[11px] text-ink-400">Hors cashprizes, transferts, primes, voyages LAN et campagnes ponctuelles.</div>
          </Panel>
          <Panel title="Revenus vs dépenses (mensuel)" className="col-span-2">
            <div className="h-56">{monthly.length ? <ResponsiveContainer><BarChart data={monthly}><CartesianGrid stroke="#23272e" vertical={false} /><XAxis dataKey="month" tick={{ fill: '#8a919c', fontSize: 10 }} /><YAxis tick={{ fill: '#8a919c', fontSize: 10 }} width={50} tickFormatter={v => money(v)} /><Tooltip {...tt} /><Legend wrapperStyle={{ fontSize: 11 }} /><RBar dataKey="income" name="Revenus" fill="#3fcf8e" isAnimationActive={false} /><RBar dataKey="expense" name="Dépenses" fill="#f25555" isAnimationActive={false} /></BarChart></ResponsiveContainer> : <Empty>Disponible après le premier bilan mensuel.</Empty>}</div>
          </Panel>
          <Panel title="Évolution de la trésorerie" className="col-span-3">
            <div className="h-48">{monthly.length ? <ResponsiveContainer><LineChart data={monthly}><CartesianGrid stroke="#23272e" vertical={false} /><XAxis dataKey="month" tick={{ fill: '#8a919c', fontSize: 10 }} /><YAxis tick={{ fill: '#8a919c', fontSize: 10 }} width={50} tickFormatter={v => money(v)} /><Tooltip {...tt} /><Line dataKey="balance" name="Trésorerie" stroke="#ff7a1a" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <Empty>—</Empty>}</div>
          </Panel>
        </div>
      )}
      {tab === 'Compte de résultat' && (
        <Panel title={`Saison ${g.season} (au ${fmtDate(g.date)})`} pad={false}>
          <table className="data"><thead><tr><th>Catégorie</th><th className="text-right">Montant</th></tr></thead><tbody>
            {Object.entries(season.byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <tr key={k}><td>{k} {INCOME_CATS.includes(k as FinanceCategory) ? <Pill tone="good">Revenu</Pill> : <Pill tone="bad">Charge</Pill>}</td><td className={cx('text-right tnum', v >= 0 ? 'text-good' : 'text-bad')}>{money(v, false)}</td></tr>)}
          </tbody></table>
        </Panel>
      )}
      {tab === 'Journal' && (
        <Panel title="Mouvements récents" pad={false}>
          <table className="data"><thead><tr><th>Date</th><th>Catégorie</th><th>Libellé</th><th className="text-right">Montant</th></tr></thead><tbody>
            {g.ledger.filter(l => l.orgId === org.id).slice(-250).reverse().map((l, i) => <tr key={i}><td>{fmtShortDate(l.date)} {l.date.slice(0, 4)}</td><td className="text-ink-300">{l.category}</td><td>{l.label}</td><td className={cx('text-right tnum', l.amount >= 0 ? 'text-good' : 'text-bad')}>{money(l.amount, false)}</td></tr>)}
          </tbody></table>
        </Panel>
      )}
    </div>
  );
}

export function Sponsors() {
  const g = useGame();
  const org = g.orgs[g.userOrgId!];
  const notify = useStore(s => s.notify);
  const [prop, setProp] = useState<string | null>(null);
  const deals = activeDeals(g, org);
  const slots = 3 + org.facilities;
  const brands = Object.values(g.sponsors).map(s => ({ s, i: sponsorInterest(g, s, org), v: sponsorValuation(g, s, org) })).sort((a, b) => b.i.score - a.i.score);
  return (
    <div className="p-3 flex flex-col gap-3">
      <Panel title={`Partenariats actifs (${deals.length}/${slots} emplacements)`} pad={false}>
        {deals.length ? (
          <table className="data"><thead><tr><th>Marque</th><th>Secteur</th><th>Mensuel</th><th>Échéance</th><th>Objectif</th><th>Posts ce mois</th><th>Satisfaction</th><th></th></tr></thead><tbody>
            {deals.map(d => { const s = g.sponsors[d.sponsorId]; return (
              <tr key={d.id}><td className="font-medium">{s.name}</td><td className="text-ink-300">{s.industry}</td><td className="tnum text-good">{money(d.monthly)}</td><td>{fmtDate(d.end)}</td>
                <td className="text-xs">{d.objective.label} {d.objectiveMet ? <Pill tone="good">Atteint</Pill> : <span className="text-ink-400">(bonus {money(d.objective.bonus)})</span>}</td>
                <td className={cx('tnum', d.postsDone < d.postsRequired && 'text-warn')}>{d.postsDone}/{d.postsRequired}</td>
                <td className="w-28"><Bar value={d.satisfaction} /></td>
                <td><Btn small kind="danger" onClick={() => { if (confirm(`Rompre avec ${s.name} ? Pénalité : ${money(d.monthly * 2)}`)) act(gs => terminateDeal(gs, d.id)); }}>Rompre</Btn></td></tr>); })}
          </tbody></table>
        ) : <Empty>Aucun sponsor. Démarchez des marques ci-dessous.</Empty>}
        <div className="px-3 py-2 text-[11px] text-ink-400">Publiez des « Contenus sponsorisés » (Réseaux sociaux) pour remplir les obligations mensuelles, sinon la satisfaction chute et le sponsor peut partir.</div>
      </Panel>
      <Panel title="Marques" pad={false}>
        <table className="data"><thead><tr><th>Marque</th><th>Secteur</th><th>Prestige</th><th>Marchés</th><th>Audience</th><th>Profil</th><th>Intérêt</th><th>Offre max. estimée</th><th></th></tr></thead><tbody>
          {brands.map(({ s, i, v }) => (
            <tr key={s.id}>
              <td className="font-medium">{s.name}</td><td className="text-ink-300">{s.industry}</td><td className="tnum">{s.reputation}</td>
              <td className="text-[11px]">{s.regions === 'GLOBAL' ? 'Mondial' : s.regions.join(', ')}</td><td>{s.audience}</td><td className="text-ink-300">{s.style}</td>
              <td className="w-32" title={i.reasons.join(' · ')}>{i.score < 0 ? <span className="text-ink-500 text-xs">{i.reasons[0]}</span> : <><Bar value={i.score} /><span className="text-[10px] text-ink-400">{i.reasons[0] ?? ''}</span></>}</td>
              <td className="tnum">{v ? `≈ ${money(v)}/mois` : '—'}</td>
              <td><Btn small kind="primary" disabled={i.score < 25 || deals.length >= slots} onClick={() => setProp(s.id)}>Proposer</Btn></td>
            </tr>
          ))}
        </tbody></table>
      </Panel>
      {prop && <SponsorModal sid={prop} onClose={() => setProp(null)} onDone={m => notify(m, 'good')} />}
    </div>
  );
}

function SponsorModal({ sid, onClose, onDone }: { sid: string; onClose: () => void; onDone: (m: string) => void }) {
  const g = useGame();
  const org = g.orgs[g.userOrgId!];
  const s = g.sponsors[sid];
  const est = sponsorValuation(g, s, org);
  const [p, setP] = useState<SponsorProposal>({ monthly: Math.round(est * 1.1 / 50) * 50, years: 1, objective: 'placement', posts: 2 });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Modal title={`Proposition à ${s.name}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`Montant mensuel : ${money(p.monthly, false)}`}><input type="range" min={100} max={Math.max(1000, est * 2)} step={50} value={p.monthly} onChange={e => setP({ ...p, monthly: +e.target.value })} /></Field>
        <Field label="Durée"><select value={p.years} onChange={e => setP({ ...p, years: +e.target.value })}>{[1, 2, 3].map(y => <option key={y} value={y}>{y} an(s)</option>)}</select></Field>
        <Field label={`Posts sponsorisés / mois : ${p.posts}`}><input type="range" min={1} max={6} value={p.posts} onChange={e => setP({ ...p, posts: +e.target.value })} /></Field>
        <Field label="Objectif de performance"><select value={p.objective} onChange={e => setP({ ...p, objective: e.target.value as SponsorProposal['objective'] })}><option value="placement">Résultat sportif</option><option value="followers">Croissance d'audience</option><option value="posts">Volume de contenus</option></select></Field>
      </div>
      <p className="text-xs text-ink-400 my-3">Plus d'obligations promotionnelles et une durée plus longue augmentent ce que la marque accepte de payer. Un objectif atteint déclenche un bonus.</p>
      {msg && <div className="text-sm border border-ink-600 bg-ink-850 p-2 mb-3">{msg}</div>}
      <Btn kind="primary" onClick={() => { const r = act(gs => proposeSponsorDeal(gs, sid, p)); setMsg(r.message); if (r.counter) setP({ ...p, monthly: r.counter }); if (r.ok) { onDone(r.message); onClose(); } }}>Envoyer la proposition</Btn>
    </Modal>
  );
}

export function Social() {
  const g = useGame();
  const notify = useStore(s => s.notify);
  const org = g.orgs[g.userOrgId!];
  const s = org.social;
  const hist = s.history.map(h => ({ d: h.date.slice(0, 7), total: h.total }));
  const plats: [string, number][] = [['X', s.x], ['TikTok', s.tiktok], ['YouTube', s.youtube], ['Twitch', s.twitch], ['Discord', s.discord]];
  return (
    <div className="p-3 grid grid-cols-3 gap-3">
      <Panel pad={false} className="col-span-3">
        <div className="grid grid-cols-8 divide-x divide-ink-700">
          {plats.map(([l, v]) => <div key={l} className="p-3"><Stat label={l} value={num(v)} /></div>)}
          <div className="p-3"><Stat label="Total" value={num(totalFollowers(org))} tone="accent" /></div>
          <div className="p-3"><Stat label="Sentiment" value={`${Math.round(s.sentiment)}%`} tone={s.sentiment > 65 ? 'good' : s.sentiment < 45 ? 'bad' : undefined} /></div>
          <div className="p-3"><Stat label="Engagement" value={`${Math.round(s.engagement)}%`} sub={`${s.postsThisMonth} posts ce mois`} /></div>
        </div>
      </Panel>
      <Panel title="Campagnes & contenus" className="col-span-2" pad={false}>
        <table className="data"><thead><tr><th>Action</th><th>Description</th><th>Coût</th><th>Recharge</th><th></th></tr></thead><tbody>
          {(Object.keys(CAMPAIGNS) as CampaignKind[]).map(k => {
            const c = CAMPAIGNS[k]; const last = g.campaignsUsed[k];
            const ready = !last || last < g.date && (new Date(last).getTime() + c.cooldown * 864e5) <= new Date(g.date).getTime();
            return <tr key={k}><td className="font-medium">{k}</td><td className="text-xs text-ink-300 whitespace-normal">{c.desc}</td><td className="tnum">{c.cost ? money(c.cost) : 'Gratuit'}</td><td className="text-xs">{c.cooldown} j</td>
              <td><Btn small kind="primary" disabled={!ready} onClick={() => notify(act(gs => runCampaign(gs, k, gs.campaignsUsed)))}>Publier</Btn></td></tr>;
          })}
        </tbody></table>
      </Panel>
      <Panel title="Budget marketing">
        <Field label={`${money(org.marketingBudget)}/mois`}><input type="range" min={0} max={30000} step={250} value={org.marketingBudget} onChange={e => act(gs => { gs.orgs[gs.userOrgId!].marketingBudget = +e.target.value; })} /></Field>
        <p className="text-[11px] text-ink-400 mt-2">Augmente le plafond d'audience organique et la qualité des campagnes. Prélevé chaque mois.</p>
        <div className="mt-4 text-xs text-ink-300">Plus votre audience est grande, plus les revenus de contenu (YouTube, Twitch) et l'intérêt des sponsors augmentent. Les titres majeurs provoquent des pics de popularité.</div>
      </Panel>
      <Panel title="Croissance de l'audience" className="col-span-3">
        <div className="h-48">{hist.length > 1 ? <ResponsiveContainer><LineChart data={hist}><CartesianGrid stroke="#23272e" vertical={false} /><XAxis dataKey="d" tick={{ fill: '#8a919c', fontSize: 10 }} /><YAxis tick={{ fill: '#8a919c', fontSize: 10 }} width={50} tickFormatter={v => num(v)} /><Tooltip contentStyle={tt.contentStyle} formatter={v => num(Number(v))} /><Line dataKey="total" stroke="#ff7a1a" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <Empty>Historique mensuel en cours de constitution.</Empty>}</div>
      </Panel>
    </div>
  );
}

export function Club() {
  const g = useGame();
  const notify = useStore(s => s.notify);
  if (!g.userOrgId) {
    const vs = vacancies(g);
    return (
      <div className="p-3">
        <Panel title="Postes vacants" pad={false}>
          {vs.length ? <table className="data"><tbody>{vs.map(o => <tr key={o.id}><td><OrgLink org={o} /></td><td>{REGION_INFO[o.region].name}</td><td className="tnum">Rép. {Math.round(o.reputation)}</td><td className="text-right"><Btn small kind="primary" onClick={() => notify(act(gs => applyForJob(gs, o.id)))}>Postuler</Btn></td></tr>)}</tbody></table> : <Empty>Aucun poste vacant.</Empty>}
        </Panel>
      </div>
    );
  }
  const org = g.orgs[g.userOrgId];
  const upgrade = (kind: 'facilities' | 'academyLevel') => {
    const lvl = org[kind];
    const cost = (kind === 'facilities' ? FACILITY_COST : ACADEMY_COST)[lvl + 1];
    if (!cost || org.balance < cost) { notify('Fonds insuffisants.', 'bad'); return; }
    act(gs => { const o = gs.orgs[gs.userOrgId!]; book(gs, o.id, 'Infrastructures', -cost, `Amélioration ${kind === 'facilities' ? 'infrastructures' : 'académie'} niv. ${lvl + 1}`); o[kind] = lvl + 1; });
    notify('Amélioration effectuée.', 'good');
  };
  return (
    <div className="p-3 grid grid-cols-3 gap-3">
      <Panel title="Board">
        <div className="mb-3"><div className="flex justify-between text-xs mb-1"><span className="text-ink-300">Confiance</span><span className="tnum">{Math.round(org.boardConfidence)}%</span></div><Bar value={org.boardConfidence} /></div>
        <div className="text-sm">Objectif de la saison : <b className="text-accent">{org.objective}</b></div>
        <div className="text-xs text-ink-400 mt-2">Le board évalue chaque mois votre classement régional par rapport à l'objectif et la santé financière. {g.manager.founderOrgId === org.id ? 'En tant que fondateur, vous ne pouvez pas être licencié — mais une faillite met fin à la carrière.' : 'Une confiance trop basse entraîne votre licenciement.'}</div>
      </Panel>
      <Panel title="Infrastructures">
        {([['facilities', 'Gaming house & équipement', FACILITY_COST, 'Progression des joueurs, qualité des contenus, emplacements sponsors.'], ['academyLevel', 'Académie', ACADEMY_COST, 'Développement des jeunes joueurs.']] as const).map(([k, l, costs, d]) => (
          <div key={k} className="mb-4">
            <div className="flex justify-between"><span className="font-medium">{l}</span><span className="text-accent">{'■'.repeat(org[k])}<span className="text-ink-600">{'■'.repeat(5 - org[k])}</span></span></div>
            <div className="text-[11px] text-ink-400 mb-1">{d}</div>
            {org[k] < 5 ? <Btn small onClick={() => upgrade(k)}>Améliorer — {money(costs[org[k] + 1])}</Btn> : <Pill tone="good">Niveau max</Pill>}
          </div>
        ))}
        <div className="text-[11px] text-ink-400">Chaque niveau augmente aussi les frais mensuels de fonctionnement.</div>
      </Panel>
      <Panel title="Manager">
        <div className="grid grid-cols-2 gap-3"><Stat label="Nom" value={<span className="text-base">{g.manager.name}</span>} /><Stat label="Réputation" value={Math.round(g.manager.reputation)} /><Stat label="Expérience" value={`${g.manager.experience} saison(s)`} /><Stat label="Trophées" value={g.manager.trophies.length} /></div>
        <div className="text-xs text-ink-400 mt-3">En poste depuis le {g.manager.hiredDate ? fmtDate(g.manager.hiredDate) : '—'}</div>
      </Panel>
      <Panel title="Identité" className="col-span-3">
        <div className="grid grid-cols-6 gap-4 text-sm">
          <Stat label="Organisation" value={<span className="text-base">{org.name}</span>} /><Stat label="Tag" value={org.tag} /><Stat label="Siège" value={<span className="text-base">{org.hq}</span>} /><Stat label="Fondée" value={org.founded} /><Stat label="Fans" value={num(org.fans)} /><Stat label="Trophées" value={org.trophies.length} />
        </div>
      </Panel>
    </div>
  );
}
