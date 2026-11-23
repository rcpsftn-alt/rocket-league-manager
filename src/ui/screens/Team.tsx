import { useState } from 'react';
import { useGame, useStore, act } from '../store';
import type { Position, StaffRole, Tactic, TeamFocus } from '../../engine/types';
import { INDIVIDUAL_FOCUSES, STAFF_ROLES, TEAM_FOCUSES } from '../../engine/types';
import { Bar, Btn, cx, Empty, Field, Modal, Panel, Pill, PlayerLink, Stat, AbilityCell, CondDot } from '../components/ui';
import { lineup, orgPlayers, starters } from '../../engine/roster';
import { previewSide, DEFAULT_TACTIC } from '../../engine/matchsim';
import { ATTR_LABEL, age } from '../../engine/player';
import { staffOf, staffQuality, staffSalaryDemand, hireStaff, fireStaff } from '../../engine/staff';
import { coachingFactor, INTENSITY_LABEL } from '../../engine/training';
import { book } from '../../engine/ledger';
import { addDays, fmtDate, money } from '../../engine/util';
import { flag } from '../../engine/data';

const TACTIC_DEFS: { key: keyof Tactic; label: string; min: number; max: number; labels: string[]; help: string }[] = [
  { key: 'pressure', label: 'Pression offensive', min: -2, max: 2, labels: ['Très défensif', 'Prudent', 'Équilibré', 'Offensif', 'Pressing total'], help: 'Plus d\'attaque et de tirs, mais défense exposée et rotations sous tension (surtout pour les équipes peu disciplinées).' },
  { key: 'tempo', label: 'Rythme', min: -2, max: 2, labels: ['Très lent', 'Contrôlé', 'Normal', 'Rapide', 'Frénétique'], help: 'Un jeu rapide avantage l\'équipe la plus mécanique, un jeu lent l\'équipe la plus intelligente tactiquement.' },
  { key: 'boostControl', label: 'Contrôle du boost', min: 0, max: 2, labels: ['Négligé', 'Normal', 'Prioritaire'], help: 'Améliore la possession (vol de boost), coûte un peu de présence offensive.' },
  { key: 'demos', label: 'Démolitions', min: 0, max: 2, labels: ['Rares', 'Opportunistes', 'Focus démos'], help: 'Plus de démos (ouvre des occasions), légère perturbation de vos propres rotations.' },
  { key: 'challenges', label: 'Challenges', min: -2, max: 2, labels: ['Très patients', 'Patients', 'Normal', 'Agressifs', 'Tout challenger'], help: 'Les challenges agressifs gagnent des ballons si vos joueurs ont un bon timing, sinon ils exposent la défense.' },
];

export function Tactics() {
  const g = useGame();
  const org = g.orgs[g.userOrgId!];
  const st = starters(g, org.id);
  const lu = lineup(g, org);
  const t = org.tactic;
  const prev = lu.length ? previewSide(g, org, lu) : null;
  const base = lu.length ? previewSide(g, org, lu, DEFAULT_TACTIC) : null;
  const setT = (k: keyof Tactic, v: number | string) => act(gs => { (gs.orgs[gs.userOrgId!].tactic as Record<string, unknown>)[k] = v; });
  const setPos = (pid: string, pos: Position) => act(gs => {
    const o = gs.orgs[gs.userOrgId!];
    const other = Object.entries(o.positions).find(([id, p]) => p === pos && id !== pid && starters(gs, o.id).some(x => x.id === id));
    if (other) o.positions[other[0]] = o.positions[pid];
    o.positions[pid] = pos;
  });
  const delta = (a: number, b: number) => { const d = a - b; return <span className={cx('text-[11px] tnum', d > 0.05 ? 'text-good' : d < -0.05 ? 'text-bad' : 'text-ink-400')}>{d > 0 ? '+' : ''}{d.toFixed(1)}</span>; };
  return (
    <div className="p-3 grid grid-cols-3 gap-3">
      <Panel title="Consignes d'équipe" className="col-span-2">
        <div className="flex flex-col gap-4">
          {TACTIC_DEFS.map(d => (
            <div key={d.key} className="grid grid-cols-[180px_1fr_140px] gap-4 items-center">
              <div><div className="font-medium">{d.label}</div><div className="text-[11px] text-ink-400 leading-tight">{d.help}</div></div>
              <input type="range" min={d.min} max={d.max} step={1} value={t[d.key] as number} onChange={e => setT(d.key, +e.target.value)} />
              <div className="text-accent text-right font-semibold">{d.labels[(t[d.key] as number) - d.min]}</div>
            </div>
          ))}
          <div className="grid grid-cols-[180px_1fr_140px] gap-4 items-center">
            <div><div className="font-medium">Rotations</div><div className="text-[11px] text-ink-400">Serrées : plus solide derrière. Libres : plus créatif devant.</div></div>
            <div className="flex gap-2">{(['tight', 'standard', 'loose'] as const).map(r => <Btn key={r} small kind={t.rotation === r ? 'primary' : 'default'} onClick={() => setT('rotation', r)}>{r === 'tight' ? 'Serrées' : r === 'standard' ? 'Standard' : 'Libres'}</Btn>)}</div>
            <div />
          </div>
        </div>
      </Panel>
      <Panel title="Profil d'équipe (simulation)">
        {prev && base ? (
          <div className="flex flex-col gap-3">
            {([['Attaque', prev.attack, base.attack], ['Défense', prev.defense, base.defense], ['Contrôle / possession', prev.control, base.control], ['Qualité des rotations', prev.rotation, base.rotation]] as [string, number, number][]).map(([l, v, b]) => (
              <div key={l}><div className="flex justify-between text-xs mb-1"><span className="text-ink-300">{l}</span><span className="tnum">{v.toFixed(1)} {delta(v, b)}</span></div><Bar value={v} /></div>
            ))}
            <div className="text-xs text-ink-300">Chimie : <b className="text-white">{Math.round(prev.chem)}%</b> · Taux de démos : {(prev.demoRate * 100).toFixed(1)}%/phase</div>
            <div className="text-[11px] text-ink-400">Les écarts sont calculés par rapport à la tactique par défaut. Ces valeurs alimentent directement le moteur de match.</div>
          </div>
        ) : <Empty>Aucun joueur.</Empty>}
      </Panel>
      <Panel title="Postes des titulaires" className="col-span-2" pad={false}>
        {st.length ? (
          <table className="data"><thead><tr><th>Joueur</th><th>Poste naturel</th><th>Style</th><th>Poste assigné</th><th>Attributs clés</th></tr></thead><tbody>
            {st.map(p => {
              const pos = org.positions[p.id] ?? p.position;
              const keys = pos === 1 ? ['shooting', 'offAwareness', 'aerial'] : pos === 2 ? ['ballControl', 'decisions', 'boost'] : ['defAwareness', 'positioning', 'recoveries'];
              return (
                <tr key={p.id}>
                  <td><PlayerLink p={p} /></td><td>{p.position}e homme</td><td className="text-ink-300">{p.playstyle}</td>
                  <td><div className="flex gap-1">{([1, 2, 3] as Position[]).map(x => <Btn key={x} small kind={pos === x ? 'primary' : 'default'} onClick={() => setPos(p.id, x)}>{x}e</Btn>)}{pos !== p.position && <Pill tone="warn">Hors poste</Pill>}</div></td>
                  <td className="text-xs text-ink-300">{keys.map(k => `${ATTR_LABEL[k as keyof typeof ATTR_LABEL]} ${Math.round(p.attrs[k as keyof typeof p.attrs])}`).join(' · ')}</td>
                </tr>
              );
            })}
          </tbody></table>
        ) : <Empty>Désignez des titulaires dans l'écran Effectif.</Empty>}
      </Panel>
      <Panel title="Composition">
        <div className="text-xs text-ink-300 leading-relaxed">
          Le moteur pénalise : un joueur hors de son poste naturel (-2,5%), l'absence de 3e homme (-5%), trois profils offensifs (défense -9%) ou trois profils défensifs (attaque -8%). Un Playmaker augmente la création ; deux Playmakers fragilisent la défense.
          <div className="mt-2">Styles actuels : {st.map(p => <Pill key={p.id}>{p.playstyle}</Pill>)}</div>
        </div>
      </Panel>
    </div>
  );
}

export function Training() {
  const g = useGame();
  const { notify } = useStore();
  const org = g.orgs[g.userOrgId!];
  const ps = orgPlayers(g, org.id);
  const tf = org.trainingFocus;
  const bootcampCost = 12000 + org.region.length * 0 + (org.reputation * 150);
  const inBootcamp = org.bootcampUntil && org.bootcampUntil >= g.date;
  const factors: [string, number][] = [['Mécanique', coachingFactor(g, org, 'mech')], ['Tactique', coachingFactor(g, org, 'iq')], ['Mental', coachingFactor(g, org, 'mental')], ['Jeunes', coachingFactor(g, org, 'youth')]];
  return (
    <div className="p-3 grid grid-cols-3 gap-3">
      <Panel title="Programme collectif" className="col-span-2">
        <div className="grid grid-cols-4 gap-2 mb-4">
          {TEAM_FOCUSES.map(f => (
            <button key={f} onClick={() => act(gs => { gs.orgs[gs.userOrgId!].trainingFocus.focus = f as TeamFocus; })} className={cx('p-2 border text-left cursor-pointer', tf.focus === f ? 'border-accent bg-accent/10' : 'border-ink-600 hover:border-ink-400')}>
              <div className="font-medium">{f}</div>
              <div className="text-[10px] text-ink-400">{({ 'Équilibré': 'Progression globale', 'Mécanique': 'Contrôle, aérien, resets', 'Tactique': 'Rotations, décisions, boost', 'Défense': 'Placement, saves, challenges', 'Attaque': 'Tirs, vision, aérien', 'Cohésion': 'Chimie d\'équipe ++', 'Mental': 'Sang-froid, clutch, régularité', 'Récupération': 'Fatigue et burnout ↓' } as Record<string, string>)[f]}</div>
            </button>
          ))}
        </div>
        <Field label={`Intensité : ${INTENSITY_LABEL[tf.intensity]}`}>
          <input type="range" min={0} max={3} value={tf.intensity} onChange={e => act(gs => { gs.orgs[gs.userOrgId!].trainingFocus.intensity = +e.target.value as 0 | 1 | 2 | 3; })} />
        </Field>
        <div className="text-[11px] text-ink-400 mt-2">Intensive : +35% de progression mais fatigue rapide, moral en baisse et risque de burnout. Repos : récupération maximale, progression minimale.</div>
        <div className="mt-4 flex items-center gap-3 border-t border-ink-700 pt-3">
          <div className="flex-1"><div className="font-medium">Bootcamp (7 jours)</div><div className="text-[11px] text-ink-400">Chimie ×2, intensité +1. Coût : {money(bootcampCost)}.</div></div>
          {inBootcamp ? <Pill tone="good">En cours jusqu'au {fmtDate(org.bootcampUntil!)}</Pill> :
            <Btn kind="primary" disabled={org.balance < bootcampCost} onClick={() => { act(gs => { const o = gs.orgs[gs.userOrgId!]; book(gs, o.id, 'Bootcamps', -bootcampCost, 'Bootcamp 7 jours'); o.bootcampUntil = addDays(gs.date, 7); }); notify('Bootcamp réservé.', 'good'); }}>Organiser un bootcamp</Btn>}
        </div>
      </Panel>
      <Panel title="Efficacité du staff">
        {factors.map(([l, v]) => <div key={l} className="mb-2"><div className="flex justify-between text-xs mb-1"><span className="text-ink-300">{l}</span><span className="tnum">×{v.toFixed(2)}</span></div><Bar value={(v - 0.4) * 80} /></div>)}
        <div className="text-[11px] text-ink-400">Dépend du head coach, de l'assistant, du coach mental/académie et des infrastructures (niveau {org.facilities}).</div>
      </Panel>
      <Panel title="Plans individuels" className="col-span-3" pad={false}>
        <table className="data"><thead><tr><th></th><th>Joueur</th><th>Âge</th><th>Niveau</th><th>Focus individuel</th><th>Fatigue</th><th>Burnout</th><th>Moral</th></tr></thead><tbody>
          {ps.map(p => (
            <tr key={p.id}>
              <td><CondDot p={p} /></td><td><PlayerLink p={p} /></td><td className="tnum">{age(g, p)}</td><td><AbilityCell g={g} p={p} /></td>
              <td><select value={org.individualTraining[p.id] ?? 'Aucun'} onChange={e => act(gs => { gs.orgs[gs.userOrgId!].individualTraining[p.id] = e.target.value as never; })}>{INDIVIDUAL_FOCUSES.map(f => <option key={f}>{f}</option>)}</select></td>
              <td className="w-28"><Bar value={p.cond.fatigue} color={p.cond.fatigue > 70 ? '#f25555' : '#e8d44d'} /></td>
              <td className="w-28"><Bar value={p.cond.burnout} color={p.cond.burnout > 60 ? '#f25555' : '#8a919c'} /></td>
              <td className="tnum">{Math.round(p.cond.morale)}</td>
            </tr>
          ))}
        </tbody></table>
      </Panel>
    </div>
  );
}

export function StaffScreen() {
  const g = useGame();
  const { notify } = useStore();
  const org = g.orgs[g.userOrgId!];
  const mine = staffOf(g, org.id);
  const [role, setRole] = useState<StaffRole>('Head coach');
  const [hiring, setHiring] = useState<string | null>(null);
  const market = Object.values(g.staff).filter(s => !s.orgId && s.role === role).sort((a, b) => staffQuality(b) - staffQuality(a));
  const h = hiring ? g.staff[hiring] : null;
  return (
    <div className="p-3 grid grid-cols-2 gap-3">
      <Panel title={`Votre staff (${mine.length}/8)`} pad={false}>
        {mine.length ? (
          <table className="data"><thead><tr><th>Nom</th><th>Rôle</th><th>Qualité</th><th>Salaire</th><th>Contrat</th><th></th></tr></thead><tbody>
            {mine.map(s => <tr key={s.id}><td>{flag(s.nationality)} {s.name}</td><td>{s.role}</td><td className="tnum">{staffQuality(s).toFixed(1)}/20</td><td className="tnum">{money(s.salary)}</td><td className="text-[11px] text-ink-300">{s.contractEnd?.slice(0, 4)}</td>
              <td className="text-right"><Btn small kind="danger" onClick={() => { const comp = s.salary * 3; if (confirm(`Licencier ${s.name} ? Indemnité : ${money(comp)}`)) { act(gs => { book(gs, org.id, 'Salaires staff', -comp, `Indemnité — ${s.name}`); fireStaff(gs, s); }); notify(`${s.name} a quitté le club.`); } }}>Licencier</Btn></td></tr>)}
          </tbody></table>
        ) : <Empty>Aucun membre du staff.</Empty>}
      </Panel>
      <Panel title="Marché du staff" pad={false} right={<select value={role} onChange={e => setRole(e.target.value as StaffRole)}>{STAFF_ROLES.map(r => <option key={r}>{r}</option>)}</select>}>
        <table className="data"><thead><tr><th>Nom</th><th>Âge</th><th>Méca</th><th>Tact</th><th>Mental</th><th>Physique</th><th>Jeunes</th><th>Analyse</th><th>Motiv.</th><th>Rép.</th><th>Salaire</th><th></th></tr></thead><tbody>
          {market.slice(0, 40).map(s => <tr key={s.id}><td>{flag(s.nationality)} {s.name}</td><td>{s.age}</td>{(['mechanics', 'tactics', 'mental', 'fitness', 'youth', 'analysis', 'motivation'] as const).map(k => <td key={k} className="tnum" style={{ color: s.attrs[k] >= 15 ? '#3fcf8e' : s.attrs[k] >= 10 ? '#e8d44d' : '#8a919c' }}>{s.attrs[k]}</td>)}<td className="tnum">{s.reputation}</td><td className="tnum">{money(staffSalaryDemand(s, org.reputation))}</td><td><Btn small kind="primary" disabled={mine.length >= 8} onClick={() => setHiring(s.id)}>Engager</Btn></td></tr>)}
        </tbody></table>
      </Panel>
      {h && <HireModal sId={h.id} onClose={() => setHiring(null)} />}
    </div>
  );
}

function HireModal({ sId, onClose }: { sId: string; onClose: () => void }) {
  const g = useGame();
  const notify = useStore(s => s.notify);
  const s = g.staff[sId];
  const org = g.orgs[g.userOrgId!];
  const demand = staffSalaryDemand(s, org.reputation);
  const repOk = org.reputation + 15 >= s.reputation;
  const need = Math.round(demand * (repOk ? 0.95 : 1.25) / 50) * 50;
  const [salary, setSalary] = useState(need);
  const [years, setYears] = useState(2);
  return (
    <Modal title={`Engager ${s.name} (${s.role})`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-3 mb-3"><Stat label="Qualité" value={`${staffQuality(s).toFixed(1)}/20`} /><Stat label="Demande" value={money(demand)} /><Stat label="Réputation" value={s.reputation} /></div>
      {!repOk && <div className="text-warn text-xs mb-2">Votre organisation manque de prestige : il faudra offrir +25%.</div>}
      <Field label={`Salaire : ${money(salary, false)}/mois`}><input type="range" min={Math.round(demand * 0.6)} max={demand * 2.5} step={50} value={salary} onChange={e => setSalary(+e.target.value)} /></Field>
      <div className="mt-2"><Field label="Durée"><select value={years} onChange={e => setYears(+e.target.value)}>{[1, 2, 3].map(y => <option key={y} value={y}>{y} an(s)</option>)}</select></Field></div>
      <div className="mt-4"><Btn kind="primary" onClick={() => {
        if (salary < need) { notify(`${s.name} refuse : salaire insuffisant.`, 'bad'); return; }
        act(gs => hireStaff(gs, gs.staff[sId], gs.userOrgId!, salary, years));
        notify(`${s.name} rejoint votre staff !`, 'good'); onClose();
      }}>Proposer le contrat</Btn></div>
    </Modal>
  );
}
