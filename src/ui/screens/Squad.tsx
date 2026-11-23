import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { useGame, useStore, act } from '../store';
import type { AttrKey, ContractTerms, GameState, Player, SquadRole } from '../../engine/types';
import { IQ_KEYS, MECH_KEYS, MENTAL_KEYS, INDIVIDUAL_FOCUSES } from '../../engine/types';
import { AbilityCell, AttrValue, Bar, Btn, CondDot, cx, Empty, Field, Modal, moraleLabel, moraleTone, OrgBadge, OrgLink, Panel, Pill, PlayerLink, PotCell, Stat, useSort, Stars } from '../components/ui';
import { ATTR_LABEL, age, askingFee, avgRating, ca, knowledge, potentialStars, recentForm, displayName, salaryDemand } from '../../engine/player';
import { orgPlayers, starters, assignPositions } from '../../engine/roster';
import { flag, NATION_BY_CODE, REGION_INFO } from '../../engine/data';
import { fmtDate, money, num } from '../../engine/util';
import { makeOffer, openNegotiation, proposeTerms, releaseCost, releasePlayer, interestIn, yearsLeftLabel, transferWindowOpen } from '../../engine/transfers';
import { staffOf } from '../../engine/staff';
import { teamChemistry, pairChem } from '../../engine/chemistry';
import { regionRank, worldRank } from './Dashboard';

const ROLE_LABEL: Record<SquadRole, string> = { starter: 'Titulaire', sub: 'Remplaçant', academy: 'Académie' };

export function Squad() {
  const g = useGame();
  const org = g.orgs[g.userOrgId!];
  const ps = orgPlayers(g, org.id);
  const { sorted, th } = useSort(ps, { key: 'role', dir: 1 }, {
    role: p => (p.squadRole === 'starter' ? 0 : p.squadRole === 'sub' ? 1 : 2) * 1000 - ca(p), tag: p => p.tag.toLowerCase(), age: p => age(g, p), ca: p => ca(p),
    form: p => recentForm(p), morale: p => p.cond.morale, fat: p => p.cond.fatigue, sal: p => p.contract?.salary ?? 0, val: p => p.value, end: p => p.contract?.end ?? '',
  });
  const setRole = (p: Player, r: SquadRole) => act(gs => {
    const o = gs.orgs[gs.userOrgId!];
    if (r === 'starter') { const st = starters(gs, o.id); if (st.length >= 3) { const out = st.sort((a, b) => ca(a) - ca(b))[0]; out.squadRole = 'sub'; } }
    if (p.squadRole === 'starter' && r !== 'starter') p.cond.morale = Math.max(0, p.cond.morale - 8);
    if (r === 'starter') p.cond.morale = Math.min(100, p.cond.morale + 5);
    p.squadRole = r; assignPositions(gs, o);
  });
  const chem = teamChemistry(g, org, starters(g, org.id).map(p => p.id));
  const wage = ps.reduce((a, p) => a + (p.contract?.salary ?? 0), 0);
  return (
    <div className="p-3 flex flex-col gap-3">
      <Panel pad={false}>
        <div className="grid grid-cols-5 divide-x divide-ink-700">
          <div className="p-3"><Stat label="Joueurs" value={ps.length} sub={`${starters(g, org.id).length}/3 titulaires`} /></div>
          <div className="p-3"><Stat label="Masse salariale" value={`${money(wage)}/mois`} /></div>
          <div className="p-3"><Stat label="Cohésion titulaires" value={`${Math.round(chem)}%`} tone={chem > 60 ? 'good' : chem < 35 ? 'bad' : undefined} /></div>
          <div className="p-3"><Stat label="Niveau moyen" value={(starters(g, org.id).reduce((a, p) => a + ca(p), 0) / Math.max(1, starters(g, org.id).length)).toFixed(1)} /></div>
          <div className="p-3"><Stat label="Valeur effectif" value={money(ps.reduce((a, p) => a + p.value, 0))} /></div>
        </div>
      </Panel>
      {starters(g, org.id).length < 3 && <div className="bg-bad/10 border border-bad/40 px-3 py-2 text-sm text-bad">Moins de 3 titulaires : des remplaçants (ou des stand-ins non rémunérés de niveau inconnu) joueront à leur place. Recrutez !</div>}
      <Panel title="Effectif" pad={false}>
        <table className="data">
          <thead><tr><th></th>{th('tag', 'Joueur')}{th('role', 'Statut')}<th>Poste</th><th>Style</th>{th('age', 'Âge')}{th('ca', 'Niveau')}<th>Pot.</th>{th('form', 'Forme')}{th('morale', 'Moral')}{th('fat', 'Fatigue')}{th('sal', 'Salaire')}{th('val', 'Valeur')}{th('end', 'Fin contrat')}<th></th></tr></thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.id}>
                <td><CondDot p={p} /></td>
                <td><PlayerLink p={p} />{org.captainId === p.id && <span className="ml-1 text-[10px] text-accent font-bold">C</span>}</td>
                <td>
                  <select value={p.squadRole ?? 'sub'} onChange={e => setRole(p, e.target.value as SquadRole)} className="!py-0 !h-6 text-xs">
                    {(['starter', 'sub', 'academy'] as SquadRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </td>
                <td className="text-ink-300">{p.squadRole === 'starter' ? `${org.positions[p.id] ?? p.position}e homme` : `(${p.position}e)`}</td>
                <td className="text-ink-300">{p.playstyle}</td>
                <td className="tnum">{age(g, p)}</td>
                <td><AbilityCell g={g} p={p} /></td>
                <td><PotCell g={g} p={p} /></td>
                <td className="tnum">{recentForm(p) ? recentForm(p).toFixed(2) : '—'}</td>
                <td><Pill tone={moraleTone(p.cond.morale)}>{moraleLabel(p.cond.morale)}</Pill>{p.unhappy ? <span title="Mécontent" className="ml-1 text-bad">!</span> : null}</td>
                <td className="w-24"><Bar value={p.cond.fatigue} color={p.cond.fatigue > 70 ? '#f25555' : p.cond.fatigue > 45 ? '#f0b429' : '#3fcf8e'} /></td>
                <td className="tnum">{money(p.contract?.salary ?? 0)}</td>
                <td className="tnum">{money(p.value)}</td>
                <td className="text-[11px] text-ink-300">{p.contract ? fmtDate(p.contract.end) : '—'}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <ChemistryGrid />
    </div>
  );
}

function ChemistryGrid() {
  const g = useGame();
  const org = g.orgs[g.userOrgId!];
  const ps = orgPlayers(g, org.id).filter(p => p.squadRole !== 'academy');
  if (ps.length < 2) return null;
  return (
    <Panel title="Matrice d'affinités (chimie par paire)" pad={false}>
      <table className="data">
        <thead><tr><th></th>{ps.map(p => <th key={p.id}>{p.tag}</th>)}</tr></thead>
        <tbody>
          {ps.map(a => (
            <tr key={a.id}><td className="font-medium">{a.tag} <span className="text-ink-400 text-[10px]">{a.hidden.personality}</span></td>
              {ps.map(b => { if (a === b) return <td key={b.id} className="text-ink-600">—</td>; const v = pairChem(g, org, a, b); return <td key={b.id} className="tnum" style={{ color: v > 65 ? '#3fcf8e' : v > 40 ? '#e8d44d' : '#f0a03c' }}>{Math.round(v)}</td>; })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 text-[11px] text-ink-400">La chimie progresse en jouant ensemble (plus vite en cas de victoire), via l'entraînement « Cohésion » et les bootcamps. Elle dépend aussi de la compatibilité de caractère et de nationalité.</div>
    </Panel>
  );
}

// ======================================================================== player profile
function AttrGroup({ g, p, title, keys }: { g: GameState; p: Player; title: string; keys: readonly AttrKey[] }) {
  return (
    <Panel title={title} pad={false}>
      <div className="py-1">
        {keys.map(k => (
          <div key={k} className="flex items-center justify-between px-3 h-[22px]">
            <span className="text-ink-200">{ATTR_LABEL[k]}</span>
            <AttrValue g={g} p={p} v={p.attrs[k]} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function PlayerProfile({ id }: { id: string }) {
  const g = useGame();
  const { nav, notify } = useStore();
  const [offerOpen, setOfferOpen] = useState(false);
  const p = g.players[id];
  if (!p) return <Empty>Joueur introuvable (retraité et archivé).</Empty>;
  const org = p.orgId ? g.orgs[p.orgId] : null;
  const mine = !!org && org.id === g.userOrgId;
  const k = knowledge(g, p);
  const userOrg = g.userOrgId ? g.orgs[g.userOrgId] : null;
  const shortlisted = g.shortlist.includes(p.id);
  const ratings = p.recentRatings.map((r, i) => ({ i: i + 1, r }));

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="bg-ink-900 border border-ink-700 flex items-stretch">
        <div className="w-1.5" style={{ background: org?.colors[0] ?? '#3d434d' }} />
        <div className="p-4 flex-1 flex items-center gap-5">
          <div className="w-16 h-16 bg-ink-800 border border-ink-600 flex items-center justify-center text-3xl">{flag(p.nationality)}</div>
          <div className="min-w-0">
            <div className="text-2xl font-bold leading-tight">{p.tag}{p.retired && <span className="ml-2 text-sm text-ink-400">(retraité)</span>}</div>
            <div className="text-ink-300">{p.firstName || p.lastName ? `${p.firstName} ${p.lastName} · ` : ''}{age(g, p)} ans · {NATION_BY_CODE[p.nationality]?.name} · {p.archetype}</div>
            <div className="mt-1 flex items-center gap-2 text-xs">{org ? <OrgLink org={org} /> : <Pill tone="info">Agent libre</Pill>}{p.squadRole && <Pill>{ROLE_LABEL[p.squadRole]}</Pill>}<Pill>{p.position}e homme</Pill><Pill>{p.playstyle}</Pill></div>
          </div>
          <div className="flex-1" />
          <div className="grid grid-cols-4 gap-6 text-right">
            <Stat label="Niveau" value={<AbilityCell g={g} p={p} />} sub={<Stars n={Math.max(0.5, Math.round((ca(p) - 40) / 11.5 * 2) / 2)} />} />
            <Stat label="Potentiel" value={<PotCell g={g} p={p} />} sub={k < 45 ? 'Scouting requis' : `Connaissance ${Math.round(k)}%`} />
            <Stat label="Valeur" value={money(p.value)} sub={p.contract?.buyout ? `Clause ${money(p.contract.buyout)}` : 'Pas de clause'} />
            <Stat label="Salaire" value={p.contract ? money(p.contract.salary) : '—'} sub={p.contract ? `jusqu'au ${fmtDate(p.contract.end)}` : 'Sans contrat'} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {mine && <MyPlayerActions p={p} />}
        {!mine && userOrg && !p.retired && <>
          <Btn kind="primary" onClick={() => setOfferOpen(true)}>{org ? 'Faire une offre' : 'Proposer un contrat'}</Btn>
          <Btn onClick={() => act(gs => { if (shortlisted) gs.shortlist = gs.shortlist.filter(x => x !== p.id); else gs.shortlist.push(p.id); })}>{shortlisted ? 'Retirer de la shortlist' : 'Ajouter à la shortlist'}</Btn>
        </>}
        {org && <Btn kind="ghost" onClick={() => nav('org', org.id)}>Voir {org.tag}</Btn>}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <AttrGroup g={g} p={p} title="Mécanique" keys={MECH_KEYS} />
        <AttrGroup g={g} p={p} title="Intelligence de jeu" keys={IQ_KEYS} />
        <AttrGroup g={g} p={p} title="Mental" keys={MENTAL_KEYS} />
        <div className="flex flex-col gap-3">
          <Panel title="Condition">
            {([['Forme', p.cond.form], ['Moral', p.cond.morale], ['Fatigue', p.cond.fatigue], ['Risque burnout', p.cond.burnout]] as [string, number][]).map(([l, v]) => (
              <div key={l} className="mb-2"><div className="flex justify-between text-xs mb-0.5"><span className="text-ink-300">{l}</span><span className="tnum">{Math.round(v)}</span></div><Bar value={l === 'Fatigue' || l === 'Risque burnout' ? 100 - v : v} /></div>
            ))}
            {p.cond.injuredUntil && <div className="text-bad text-xs">Indisponible jusqu'au {fmtDate(p.cond.injuredUntil)}</div>}
          </Panel>
          <Panel title="Profil caché">
            <div className="text-xs flex flex-col gap-1">
              <Row l="Personnalité" v={k >= 70 ? p.hidden.personality : '?'} />
              <Row l="Ambition" v={k >= 80 ? `${p.hidden.ambition}/20` : '?'} />
              <Row l="Loyauté" v={k >= 80 ? `${p.hidden.loyalty}/20` : '?'} />
              <Row l="Sensibilité pression" v={k >= 85 ? `${p.hidden.pressureSensitivity}/20` : '?'} />
              <Row l="Fragilité" v={k >= 85 ? `${p.hidden.injuryProneness}/20` : '?'} />
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Panel title="Statistiques" pad={false}>
          <table className="data">
            <thead><tr><th></th><th>MJ</th><th>V%</th><th>Buts</th><th>PD</th><th>Arrêts</th><th>Tirs</th><th>Démos</th><th>MVP</th><th>Note</th></tr></thead>
            <tbody>
              {([['Saison', p.season], ['Carrière', p.career]] as const).map(([l, s]) => (
                <tr key={l}><td className="text-ink-300">{l}</td><td className="tnum">{s.games}</td><td className="tnum">{s.games ? Math.round(s.wins / s.games * 100) : 0}</td><td className="tnum">{s.goals}</td><td className="tnum">{s.assists}</td><td className="tnum">{s.saves}</td><td className="tnum">{s.shots}</td><td className="tnum">{s.demos}</td><td className="tnum">{s.mvps}</td><td className="tnum font-semibold">{avgRating(s) ? avgRating(s).toFixed(2) : '—'}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-xs text-ink-300">Gains en carrière : <b className="text-white">{money(p.careerEarnings)}</b> · Abonnés : {num(p.followers)} · Popularité {Math.round(p.popularity)} · Réputation {Math.round(p.reputation)}</div>
        </Panel>
        <Panel title="Notes récentes">
          <div className="h-36">
            {ratings.length ? <ResponsiveContainer><LineChart data={ratings}><XAxis dataKey="i" hide /><YAxis domain={[4, 10]} width={24} tick={{ fill: '#8a919c', fontSize: 10 }} /><ReferenceLine y={6.5} stroke="#3d434d" /><Tooltip contentStyle={{ background: '#15181c', border: '1px solid #2e333b', fontSize: 11 }} /><Line dataKey="r" stroke="#ff7a1a" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <Empty>Aucun match récent</Empty>}
          </div>
        </Panel>
        <Panel title="Palmarès & carrière">
          <div className="text-xs flex flex-col gap-1 max-h-36 overflow-auto">
            {p.achievements.length ? p.achievements.slice().reverse().map((a, i) => <div key={i} className="text-accent">🏆 {a}</div>) : <div className="text-ink-400">Aucun titre.</div>}
            <div className="mt-2 text-ink-400">Parcours : {[...new Map(p.history.map(h => [h.orgName, h])).values()].map(h => `${h.orgName} (${h.season})`).join(' → ') || '—'}</div>
          </div>
        </Panel>
      </div>
      {offerOpen && <OfferModal p={p} onClose={() => setOfferOpen(false)} />}
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) { return <div className="flex justify-between"><span className="text-ink-300">{l}</span><span>{v}</span></div>; }

function MyPlayerActions({ p }: { p: Player }) {
  const g = useGame();
  const notify = useStore(s => s.notify);
  const org = g.orgs[g.userOrgId!];
  const [confirmRel, setConfirmRel] = useState(false);
  const [listPrice, setListPrice] = useState<number | null>(null);
  return (
    <>
      <Btn kind="primary" onClick={() => act(gs => openNegotiation(gs, p.id, 0, true), { save: false })}>Prolonger le contrat</Btn>
      <Btn onClick={() => act(gs => { gs.orgs[gs.userOrgId!].captainId = p.id; })}>Nommer capitaine</Btn>
      <select value={org.individualTraining[p.id] ?? 'Aucun'} onChange={e => act(gs => { gs.orgs[gs.userOrgId!].individualTraining[p.id] = e.target.value as never; })} title="Entraînement individuel">
        {INDIVIDUAL_FOCUSES.map(f => <option key={f} value={f}>Focus : {f}</option>)}
      </select>
      {p.askingOffer ? <Btn onClick={() => act(() => { p.askingOffer = undefined; })}>Retirer de la liste des transferts</Btn> : <Btn onClick={() => setListPrice(Math.round(p.value / 1000) * 1000)}>Placer sur la liste des transferts</Btn>}
      <Btn kind="danger" onClick={() => setConfirmRel(true)}>Libérer</Btn>
      {listPrice != null && <Modal title={`Mettre ${p.tag} sur la liste des transferts`} onClose={() => setListPrice(null)}>
        <Field label={`Prix demandé : ${money(listPrice)}`}><input type="range" min={0} max={Math.max(10000, p.value * 3)} step={1000} value={listPrice} onChange={e => setListPrice(+e.target.value)} /></Field>
        <p className="text-xs text-ink-400 my-3">Les organisations IA pourront faire des offres pendant les fenêtres de transfert. Le joueur peut mal le vivre.</p>
        <Btn kind="primary" onClick={() => { act(() => { p.askingOffer = listPrice; p.cond.morale = Math.max(0, p.cond.morale - 6); }); setListPrice(null); }}>Confirmer</Btn>
      </Modal>}
      {confirmRel && <Modal title={`Libérer ${p.tag} ?`} onClose={() => setConfirmRel(false)}>
        <p className="mb-4 text-sm">Résiliation à l'amiable : indemnité de <b>{money(releaseCost(g, p))}</b> (50% du salaire restant). Le joueur devient agent libre.</p>
        <div className="flex gap-2"><Btn kind="danger" onClick={() => { act(gs => releasePlayer(gs, p)); setConfirmRel(false); notify(`${p.tag} a été libéré.`); }}>Confirmer la libération</Btn><Btn onClick={() => setConfirmRel(false)}>Annuler</Btn></div>
      </Modal>}
    </>
  );
}

// ======================================================================== offers & negotiation
export function OfferModal({ p, onClose }: { p: Player; onClose: () => void }) {
  const g = useGame();
  const notify = useStore(s => s.notify);
  const org = p.orgId ? g.orgs[p.orgId] : null;
  const ask = askingFee(g, p);
  const [fee, setFee] = useState(Math.round(ask * 0.85 / 500) * 500);
  const [msg, setMsg] = useState<string | null>(null);
  const userOrg = g.orgs[g.userOrgId!];
  const inter = interestIn(g, p, userOrg, 'starter');
  if (!org) {
    return (
      <Modal title={`Approcher ${p.tag} (agent libre)`} onClose={onClose}>
        <p className="text-sm mb-3">Aucune indemnité de transfert : vous négociez directement le contrat.</p>
        <p className="text-xs text-ink-300 mb-4">Intérêt estimé : <b>{inter.score > 1 ? 'élevé' : inter.score > -0.5 ? 'moyen' : 'faible'}</b>. {inter.reasons.join(' · ')}</p>
        <Btn kind="primary" onClick={() => { act(gs => openNegotiation(gs, p.id, 0, false), { save: false }); onClose(); }}>Ouvrir les négociations</Btn>
      </Modal>
    );
  }
  return (
    <Modal title={`Offre pour ${p.tag} (${org.name})`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
        <Stat label="Valeur marchande" value={money(p.value)} />
        <Stat label="Contrat restant" value={yearsLeftLabel(g, p)} />
        <Stat label="Clause libératoire" value={p.contract?.buyout ? money(p.contract.buyout) : 'Aucune'} />
      </div>
      {!transferWindowOpen(g) && !p.contract?.buyout && <div className="text-warn text-xs mb-3">Mercato fermé : l'offre sera refusée (sauf clause libératoire).</div>}
      <Field label={`Indemnité proposée : ${money(fee)}`}><input type="range" min={0} max={Math.max(ask * 2, 20000)} step={500} value={fee} onChange={e => setFee(+e.target.value)} /></Field>
      <div className="flex justify-between text-[11px] text-ink-400 mt-1"><span>Votre trésorerie : {money(userOrg.balance)}</span>{p.contract?.buyout ? <span className="link" onClick={() => setFee(p.contract!.buyout)}>Payer la clause</span> : null}</div>
      <p className="text-xs text-ink-300 my-3">Intérêt du joueur : <b>{inter.score > 1 ? 'élevé' : inter.score > -0.5 ? 'moyen' : 'faible'}</b>. {inter.reasons.join(' · ')}</p>
      {msg && <div className="text-sm border border-ink-600 bg-ink-850 p-2 mb-3">{msg}</div>}
      <Btn kind="primary" onClick={() => {
        const r = act(gs => makeOffer(gs, p.id, fee));
        setMsg(r.message);
        if (r.status === 'counter' && r.counterFee) setFee(r.counterFee);
        if (r.status === 'accepted') { notify(r.message, 'good'); onClose(); }
      }}>Envoyer l'offre</Btn>
    </Modal>
  );
}

export function NegotiationHost() {
  const g = useGame();
  if (!g.negotiation) return null;
  return <NegotiationModal key={g.negotiation.playerId} />;
}

function NegotiationModal() {
  const g = useGame();
  const notify = useStore(s => s.notify);
  const n = g.negotiation!;
  const p = g.players[n.playerId];
  const org = g.orgs[n.orgId];
  const [t, setT] = useState<ContractTerms>({ ...n.lastDemand, salary: Math.round(n.lastDemand.salary * 0.9 / 50) * 50 });
  const [msg, setMsg] = useState<string | null>(null);
  const upd = (k: keyof ContractTerms, v: number | string) => setT(x => ({ ...x, [k]: v }));
  const close = () => act(gs => { gs.negotiation = null; }, { save: false });
  const d = n.lastDemand;
  const totalCost = t.salary * 12 * t.years + t.signingBonus + n.fee;
  return (
    <Modal title={`${n.renewal ? 'Prolongation' : 'Négociation'} — ${displayName(p)}`} onClose={close} width={640}>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <Stat label="Humeur" value={<span className="text-base">{n.mood}</span>} />
        <Stat label="Patience" value={'●'.repeat(Math.max(0, n.patience)) + '○'.repeat(Math.max(0, 5 - n.patience))} />
        <Stat label="Indemnité" value={money(n.fee)} />
        <Stat label="Coût total" value={money(totalCost)} sub={`${t.years} an(s)`} />
      </div>
      <div className="text-xs text-ink-300 mb-3 border border-ink-700 bg-ink-850 p-2">Demandes de l'agent : <b className="text-white">{money(d.salary)}/mois</b>, {d.years} an(s), prime à la signature {money(d.signingBonus)}, prime de victoire {money(d.winBonus)}, part des gains {Math.round(d.prizeShare * 100)}%.</div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`Salaire mensuel : ${money(t.salary, false)}`}><input type="range" min={300} max={Math.max(2000, d.salary * 2)} step={50} value={t.salary} onChange={e => upd('salary', +e.target.value)} /></Field>
        <Field label="Durée"><select value={t.years} onChange={e => upd('years', +e.target.value)}>{[1, 2, 3, 4].map(y => <option key={y} value={y}>{y} an(s) — fin {+g.date.slice(0, 4) + y - (g.date.slice(5) >= '10-01' ? 0 : 1)}</option>)}</select></Field>
        <Field label={`Prime à la signature : ${money(t.signingBonus, false)}`}><input type="range" min={0} max={Math.max(5000, d.signingBonus * 3)} step={100} value={t.signingBonus} onChange={e => upd('signingBonus', +e.target.value)} /></Field>
        <Field label={`Prime par titre : ${money(t.winBonus, false)}`}><input type="range" min={0} max={Math.max(2000, d.winBonus * 3)} step={100} value={t.winBonus} onChange={e => upd('winBonus', +e.target.value)} /></Field>
        <Field label={`Part joueurs des cashprizes : ${Math.round(t.prizeShare * 100)}%`}><input type="range" min={0.5} max={1} step={0.05} value={t.prizeShare} onChange={e => upd('prizeShare', +e.target.value)} /></Field>
        <Field label={`Clause libératoire : ${t.buyout ? money(t.buyout) : 'aucune'}`}><input type="range" min={0} max={Math.max(50000, p.value * 4)} step={5000} value={t.buyout} onChange={e => upd('buyout', +e.target.value)} /></Field>
        <Field label="Statut promis"><select value={t.role} onChange={e => upd('role', e.target.value)}><option value="starter">Titulaire</option><option value="sub">Remplaçant</option><option value="academy">Académie</option></select></Field>
        <div className="text-[11px] text-ink-400 self-end">Une clause basse rassure le joueur mais facilite son départ. Promettre la titularisation compte beaucoup pour les joueurs ambitieux.</div>
      </div>
      {msg && <div className="text-sm border border-ink-600 bg-ink-850 p-2 mt-3">{msg}</div>}
      <div className="flex gap-2 mt-4">
        <Btn kind="primary" onClick={() => {
          const r = act(gs => proposeTerms(gs, t));
          setMsg(r.message);
          if (r.status === 'accepted') notify(r.message, 'good');
          if (r.status === 'walkaway') notify(r.message, 'bad');
        }}>Soumettre l'offre</Btn>
        <Btn onClick={() => setT({ ...n.lastDemand })}>Accepter les demandes</Btn>
        <Btn kind="ghost" onClick={close}>Abandonner</Btn>
        <div className="flex-1" />
        <span className="text-[11px] text-ink-400 self-center">Demande « marché » : {money(salaryDemand(g, p, org.reputation))}/mois</span>
      </div>
    </Modal>
  );
}

// ======================================================================== org profile
export function OrgProfile({ id }: { id: string }) {
  const g = useGame();
  const org = g.orgs[id];
  if (!org) return <Empty>Organisation introuvable.</Empty>;
  const ps = orgPlayers(g, org.id);
  const staff = staffOf(g, org.id);
  const hist = (g.eloHistory[org.id] ?? []).map(h => ({ d: h.d.slice(0, 7), e: h.e }));
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="bg-ink-900 border border-ink-700 p-4 flex items-center gap-5" style={{ borderLeft: `6px solid ${org.colors[0]}` }}>
        <OrgBadge org={org} size={64} />
        <div>
          <div className="text-2xl font-bold">{org.name} {org.disbanded && <span className="text-bad text-sm">(dissoute)</span>}</div>
          <div className="text-ink-300">{org.hq}, {NATION_BY_CODE[org.country]?.name} · {REGION_INFO[org.region].name} · fondée en {org.founded} · {org.philosophy}</div>
        </div>
        <div className="flex-1" />
        <div className="grid grid-cols-5 gap-6 text-right">
          <Stat label="Rang régional" value={`#${regionRank(g, org.id)}`} />
          <Stat label="Mondial" value={`#${worldRank(g, org.id)}`} sub={`Elo ${org.elo}`} />
          <Stat label="Réputation" value={Math.round(org.reputation)} />
          <Stat label="Fans" value={num(org.fans)} />
          <Stat label="Trophées" value={org.trophies.length} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Panel title="Roster" pad={false} className="col-span-2">
          <table className="data"><thead><tr><th>Joueur</th><th>Statut</th><th>Âge</th><th>Niveau</th><th>Pot.</th><th>Note saison</th><th>Valeur</th><th>Contrat</th></tr></thead><tbody>
            {ps.sort((a, b) => (a.squadRole === 'starter' ? 0 : 1) - (b.squadRole === 'starter' ? 0 : 1)).map(p => (
              <tr key={p.id}><td><PlayerLink p={p} /></td><td className="text-ink-300">{p.squadRole ? ROLE_LABEL[p.squadRole] : ''}</td><td className="tnum">{age(g, p)}</td><td><AbilityCell g={g} p={p} /></td><td><PotCell g={g} p={p} /></td><td className="tnum">{avgRating(p.season) ? avgRating(p.season).toFixed(2) : '—'}</td><td className="tnum">{money(p.value)}</td><td className="text-[11px] text-ink-300">{p.contract?.end.slice(0, 4)}</td></tr>
            ))}
          </tbody></table>
        </Panel>
        <Panel title="Staff" pad={false}>
          {staff.length ? staff.map(s => <div key={s.id} className="px-3 py-1.5 border-b border-ink-800 flex justify-between"><span>{flag(s.nationality)} {s.name}</span><span className="text-ink-300 text-xs">{s.role}</span></div>) : <Empty>Aucun staff.</Empty>}
        </Panel>
        <Panel title="Évolution Elo" className="col-span-2">
          <div className="h-40">{hist.length > 1 ? <ResponsiveContainer><LineChart data={hist}><XAxis dataKey="d" tick={{ fill: '#8a919c', fontSize: 10 }} /><YAxis domain={['auto', 'auto']} width={36} tick={{ fill: '#8a919c', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#15181c', border: '1px solid #2e333b', fontSize: 11 }} /><Line dataKey="e" stroke={org.colors[0]} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <Empty>Données insuffisantes.</Empty>}</div>
        </Panel>
        <Panel title="Palmarès" pad={false}>
          <div className="max-h-40 overflow-auto">{org.trophies.length ? org.trophies.slice().reverse().map((t, i) => <div key={i} className="px-3 py-1 border-b border-ink-800 text-xs"><span className="text-accent">🏆</span> {t.tournament}</div>) : <Empty>Aucun trophée.</Empty>}</div>
        </Panel>
      </div>
    </div>
  );
}
