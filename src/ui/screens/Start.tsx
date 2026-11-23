import { useEffect, useMemo, useState } from 'react';
import type { Difficulty, GameState, Region } from '../../engine/types';
import { REGIONS } from '../../engine/types';
import { DIFFICULTY, NATIONS, ORG_COLORS, REGION_INFO, NATION_BY_CODE } from '../../engine/data';
import { generateWorld, startCareer } from '../../engine/world';
import { deleteSave, listSaves, loadGame, type SaveMeta } from '../../engine/save';
import { useStore, persist } from '../store';
import { Btn, cx, Field, OrgBadge, Panel, Pill } from '../components/ui';
import { DbFilePicker } from './Editor';
import { applyDatabase, type DbFile } from '../../engine/moddb';
import { ca } from '../../engine/player';
import { starters } from '../../engine/roster';
import { fmtDate, money } from '../../engine/util';

export function StartMenu() {
  const [mode, setMode] = useState<'menu' | 'new'>('menu');
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const setGame = useStore(s => s.setGame);
  const refresh = () => listSaves().then(setSaves);
  useEffect(() => { refresh(); }, []);
  if (mode === 'new') return <NewCareer onCancel={() => setMode('menu')} />;
  return (
    <div className="h-full flex">
      <div className="w-[420px] bg-ink-900 border-r border-ink-700 p-10 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-accent text-black font-black flex items-center justify-center">RLM</div>
          <div><div className="text-xl font-black tracking-wider">ROCKET LEAGUE</div><div className="text-ink-400 tracking-[0.35em] text-xs">MANAGER</div></div>
        </div>
        <p className="text-ink-300 text-sm mb-8 leading-relaxed">Prenez les commandes d'une organisation esport Rocket League. Recrutez, développez, négociez, gagnez — saison après saison.</p>
        <Btn kind="primary" className="h-10 text-sm justify-center" onClick={() => setMode('new')}>Nouvelle carrière</Btn>
        <div className="mt-auto text-[11px] text-ink-500">Monde fictif. Toutes les organisations, joueurs et marques sont inventés.</div>
      </div>
      <div className="flex-1 p-10 overflow-auto">
        <h2 className="text-xs uppercase tracking-widest text-ink-400 mb-3">Carrières sauvegardées</h2>
        {!saves.length && <div className="text-ink-400">Aucune sauvegarde pour l'instant.</div>}
        <div className="flex flex-col gap-2 max-w-3xl">
          {saves.map(s => (
            <div key={s.id} className="bg-ink-900 border border-ink-700 hover:border-ink-500 p-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-ink-300">{s.manager} · {s.org} · {fmtDate(s.date)} · {DIFFICULTY[s.difficulty as Difficulty]?.label}</div>
                <div className="text-[11px] text-ink-500">Dernière sauvegarde : {new Date(s.updatedAt).toLocaleString('fr-FR')}</div>
              </div>
              <Btn kind="primary" onClick={async () => { const g = await loadGame(s.id); if (g) { migrate(g); setGame(g); } }}>Charger</Btn>
              <Btn kind="danger" onClick={async () => { if (confirm(`Supprimer définitivement « ${s.name} » ?`)) { await deleteSave(s.id); refresh(); } }}>Supprimer</Btn>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Forward-compatible save migration. */
export function migrate(g: GameState) {
  g.campaignsUsed ??= {};
  g.rankingHistory ??= [];
  g.eloHistory ??= {};
  g.settings ??= { autosave: true, liveSpeed: 2 };
}

function NewCareer({ onCancel }: { onCancel: () => void }) {
  const setGame = useStore(s => s.setGame);
  const [step, setStep] = useState(1);
  const [manager, setManager] = useState('');
  const [nat, setNat] = useState('FR');
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [season, setSeason] = useState(2026);
  const [mode, setMode] = useState<'create' | 'takeover' | 'unemployed'>('create');
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [db, setDb] = useState<{ db: DbFile; file: string } | null>(null);
  // create org
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [region, setRegion] = useState<Region>('EU');
  const [country, setCountry] = useState('FR');
  const [hq, setHq] = useState('Paris');
  const [colors, setColors] = useState<[string, string]>(ORG_COLORS[0]);
  const [budget, setBudget] = useState(250000);
  const [rep, setRep] = useState(20);
  const [ambition, setAmbition] = useState<'Survivre' | 'Progresser' | 'Dominer'>('Progresser');
  // takeover
  const [pickOrg, setPickOrg] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<Region>('EU');
  const preview = useMemo(() => { if (!(mode === 'takeover' && step === 3)) return null; const w = generateWorld(seed, season, diff); if (db) applyDatabase(w, db.db); return w; }, [mode, step, seed, season, diff, db]);

  const nations = REGIONS.flatMap(r => NATIONS[r]);
  const canNext = step === 1 ? manager.trim().length >= 2 : step === 2 ? true : mode === 'create' ? name.trim().length >= 3 && tag.trim().length >= 2 : mode === 'takeover' ? !!pickOrg : true;

  const launch = async () => {
    const g = startCareer({
      saveName: mode === 'create' ? name : manager, managerName: manager.trim(), managerNationality: nat, difficulty: diff, season, mode, seed,
      create: mode === 'create' ? { name: name.trim(), tag: tag.trim(), region, country, hq, colors, budget, reputation: rep, ambition } : undefined,
      takeoverOrgId: pickOrg ?? undefined, db: db?.db,
    });
    // initial scouting knowledge: famous players are well known, locals are better known
    const home = g.userOrgId ? g.orgs[g.userOrgId].region : null;
    for (const p of Object.values(g.players)) if (!g.scout[p.id]) g.scout[p.id] = Math.min(85, Math.round(p.reputation * 0.8 + (p.region === home ? 15 : 0)));
    setGame(g);
    await persist(true);
  };

  return (
    <div className="h-full flex flex-col">
      <header className="h-12 border-b border-ink-700 bg-ink-900 flex items-center px-6 gap-6">
        <div className="font-bold tracking-wider">NOUVELLE CARRIÈRE</div>
        {['Manager', 'Scénario', 'Détails'].map((s, i) => <div key={s} className={cx('text-xs', step === i + 1 ? 'text-accent font-semibold' : step > i + 1 ? 'text-ink-200' : 'text-ink-500')}>{i + 1}. {s}</div>)}
        <div className="flex-1" />
        <Btn kind="ghost" onClick={onCancel}>Annuler</Btn>
      </header>
      <div className="flex-1 overflow-auto p-8">
        {step === 1 && (
          <div className="grid grid-cols-2 gap-6 max-w-3xl">
            <Field label="Nom du manager"><input autoFocus value={manager} onChange={e => setManager(e.target.value)} placeholder="Votre nom" /></Field>
            <Field label="Nationalité"><select value={nat} onChange={e => setNat(e.target.value)}>{nations.map(n => <option key={n.code} value={n.code}>{n.flag} {n.name}</option>)}</select></Field>
            <Field label="Saison de départ"><select value={season} onChange={e => setSeason(+e.target.value)}>{[2025, 2026, 2027, 2028].map(y => <option key={y}>{y}</option>)}</select></Field>
            <Field label="Base de données">
              <div className="flex items-center gap-2">
                <DbFilePicker label={db ? 'Changer de fichier' : 'Importer un fichier (.json)'} onLoad={(d, file) => setDb({ db: d, file })} />
                {db ? <span className="text-xs text-good truncate" title={db.db.note}>{db.db.name ?? db.file} <span className="link text-ink-400" onClick={() => setDb(null)}>✕</span></span> : <span className="text-xs text-ink-400">Monde fictif</span>}
              </div>
            </Field>
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-2">Difficulté</div>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(DIFFICULTY) as Difficulty[]).map(d => (
                  <button key={d} onClick={() => setDiff(d)} className={cx('p-3 border text-left cursor-pointer', diff === d ? 'border-accent bg-accent/10' : 'border-ink-600 bg-ink-900 hover:border-ink-400')}>
                    <div className="font-semibold">{DIFFICULTY[d].label}</div>
                    <div className="text-[11px] text-ink-300 mt-1">{d === 'easy' ? 'Finances généreuses, board patient.' : d === 'normal' ? 'Simulation équilibrée.' : d === 'hard' ? 'Contraintes financières réalistes.' : 'Économie et compétition impitoyables.'}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-3 gap-4 max-w-4xl">
            {([['create', 'Créer votre organisation', 'Partez de zéro : une petite structure, un budget limité, trois joueurs inconnus. Remplacez la plus faible équipe de votre région sur le circuit.'],
              ['takeover', 'Reprendre une organisation', 'Choisissez une organisation existante avec son roster, ses finances, ses sponsors et les attentes de son board.'],
              ['unemployed', 'Commencer sans club', 'Manager au chômage : postulez aux postes vacants. Les clubs évaluent votre réputation et votre expérience.']] as const).map(([k, t, d]) => (
              <button key={k} onClick={() => setMode(k)} className={cx('p-5 border text-left cursor-pointer h-44 flex flex-col', mode === k ? 'border-accent bg-accent/10' : 'border-ink-600 bg-ink-900 hover:border-ink-400')}>
                <div className="font-semibold text-base mb-2">{t}</div>
                <div className="text-xs text-ink-300 leading-relaxed">{d}</div>
              </button>
            ))}
          </div>
        )}
        {step === 3 && mode === 'create' && (
          <div className="grid grid-cols-[1fr_300px] gap-8 max-w-5xl">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nom de l'organisation"><input autoFocus value={name} onChange={e => { setName(e.target.value); if (!tag || tag === name.slice(0, 3).toUpperCase()) setTag(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()); }} placeholder="Ex. Nova Drive" /></Field>
              <Field label="Tag (2-4)"><input value={tag} maxLength={4} onChange={e => setTag(e.target.value.toUpperCase())} /></Field>
              <Field label="Région du circuit"><select value={region} onChange={e => { const r = e.target.value as Region; setRegion(r); setCountry(NATIONS[r][0].code); setHq(NATIONS[r][0].cities[0]); }}>{REGIONS.map(r => <option key={r} value={r}>{REGION_INFO[r].name}</option>)}</select></Field>
              <Field label="Pays"><select value={country} onChange={e => { setCountry(e.target.value); setHq(NATION_BY_CODE[e.target.value].cities[0]); }}>{NATIONS[region].map(n => <option key={n.code} value={n.code}>{n.flag} {n.name}</option>)}</select></Field>
              <Field label="Siège"><select value={hq} onChange={e => setHq(e.target.value)}>{NATION_BY_CODE[country]?.cities.map(c => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Ambition"><select value={ambition} onChange={e => setAmbition(e.target.value as typeof ambition)}><option>Survivre</option><option>Progresser</option><option>Dominer</option></select></Field>
              <Field label={`Budget de départ : ${money(budget)} (×${DIFFICULTY[diff].budget} difficulté)`}><input type="range" min={80000} max={800000} step={10000} value={budget} onChange={e => setBudget(+e.target.value)} /></Field>
              <Field label={`Réputation initiale : ${rep}`}><input type="range" min={5} max={40} value={rep} onChange={e => setRep(+e.target.value)} /></Field>
              <div className="col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-2">Couleurs</div>
                <div className="flex gap-2 flex-wrap">{ORG_COLORS.map((c, i) => <button key={i} onClick={() => setColors(c)} className={cx('w-9 h-9 border-2 cursor-pointer', colors === c ? 'border-white' : 'border-transparent')} style={{ background: `linear-gradient(135deg, ${c[0]} 50%, ${c[1]} 50%)` }} />)}</div>
              </div>
              <p className="col-span-2 text-xs text-ink-400">Le budget détermine votre marge pour recruter et tenir avant les premiers sponsors. La réputation, elle, évoluera avec vos résultats.</p>
            </div>
            <Panel title="Aperçu">
              <div className="flex flex-col items-center gap-3 py-4">
                <OrgBadge org={{ tag: tag || '???', colors } as never} size={80} />
                <div className="text-lg font-bold">{name || 'Votre organisation'}</div>
                <div className="text-ink-300 text-xs">{hq}, {NATION_BY_CODE[country]?.name} · {REGION_INFO[region].name}</div>
                <div className="text-xs text-ink-400 text-center">Vous prendrez la place de l'organisation la plus faible de la région et démarrerez avec 3 agents libres et un coach.</div>
              </div>
            </Panel>
          </div>
        )}
        {step === 3 && mode === 'takeover' && preview && (
          <div className="max-w-5xl">
            <div className="flex gap-1 mb-3">{REGIONS.map(r => <Btn key={r} small kind={regionFilter === r ? 'primary' : 'default'} onClick={() => setRegionFilter(r)}>{r}</Btn>)}</div>
            <Panel pad={false}>
              <table className="data">
                <thead><tr><th>Organisation</th><th>Réputation</th><th>Niveau roster</th><th>Trésorerie</th><th>Infra.</th><th>Philosophie</th><th>Difficulté</th></tr></thead>
                <tbody>
                  {Object.values(preview.orgs).filter(o => o.region === regionFilter).sort((a, b) => b.reputation - a.reputation).map(o => {
                    const lvl = starters(preview, o.id).reduce((a, p) => a + ca(p), 0) / 3;
                    return (
                      <tr key={o.id} onClick={() => setPickOrg(o.id)} className={cx('cursor-pointer', pickOrg === o.id && 'me')}>
                        <td><span className="inline-flex items-center gap-2"><OrgBadge org={o} />{o.name}</span></td>
                        <td className="tnum">{Math.round(o.reputation)}</td>
                        <td className="tnum">{lvl.toFixed(0)}</td>
                        <td className="tnum">{money(o.balance * DIFFICULTY[diff].budget)}</td>
                        <td>{'■'.repeat(o.facilities)}<span className="text-ink-600">{'■'.repeat(5 - o.facilities)}</span></td>
                        <td>{o.philosophy}</td>
                        <td>{o.reputation > 70 ? <Pill tone="bad">Attentes fortes</Pill> : o.reputation > 40 ? <Pill tone="warn">Moyenne</Pill> : <Pill tone="good">Projet</Pill>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          </div>
        )}
        {step === 3 && mode === 'unemployed' && (
          <div className="max-w-xl text-ink-300 leading-relaxed">Vous commencez sans club avec une réputation modeste. Depuis l'écran <b className="text-white">Club & board</b>, consultez les postes vacants et envoyez vos candidatures. Le temps avance normalement : la scène vit sans vous en attendant.</div>
        )}
      </div>
      <footer className="h-14 border-t border-ink-700 bg-ink-900 flex items-center justify-end px-6 gap-2">
        {step > 1 && <Btn onClick={() => setStep(step - 1)}>Retour</Btn>}
        {step < 3 ? <Btn kind="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Suivant</Btn> : <Btn kind="primary" disabled={!canNext} onClick={launch}>Lancer la carrière</Btn>}
      </footer>
    </div>
  );
}
