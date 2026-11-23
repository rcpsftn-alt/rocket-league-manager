import { useRef, useState } from 'react';
import { useGame, useStore, act } from '../store';
import type { Playstyle, Position, Region } from '../../engine/types';
import { PLAYSTYLES, REGIONS } from '../../engine/types';
import { Btn, cx, Empty, Field, OrgBadge, Panel, Tabs, AbilityCell } from '../components/ui';
import { Flag, Avatar } from '../components/ui';
import { REGION_INFO, NATIONS, NATION_BY_CODE, flag } from '../../engine/data';
import { applyDatabase, exportDatabase, parseDb, setLevel, type DbFile } from '../../engine/moddb';
import { csvToDb, CSV_HELP, ORGS_TEMPLATE, PLAYERS_TEMPLATE, TIER_BASE, TIER_LABEL } from '../../engine/csvdb';
import { ca } from '../../engine/player';
import { joinOrg, leaveOrg } from '../../engine/roster';
import { defaultContract } from '../../engine/player';

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Hidden file input + button that reads rlm-db JSON or CSV spreadsheets (several files allowed). */
export function DbFilePicker({ label, onLoad }: { label: string; onLoad: (db: DbFile, fileName: string, info?: { warnings: string[]; autoLevels: number }) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const notify = useStore(s => s.notify);
  const year = useStore(s => s.g ? +s.g.date.slice(0, 4) : new Date().getFullYear());
  return (
    <>
      <input ref={ref} type="file" multiple accept=".json,.csv,.tsv,.txt,application/json,text/csv" className="hidden" onChange={async e => {
        const files = [...(e.target.files ?? [])]; if (!files.length) return;
        try {
          const json = files.filter(f => f.name.toLowerCase().endsWith('.json'));
          const csv = files.filter(f => !f.name.toLowerCase().endsWith('.json'));
          if (json.length) onLoad(parseDb(await json[0].text()), json[0].name);
          if (csv.length) {
            const r = csvToDb(await Promise.all(csv.map(async f => ({ name: f.name, text: await f.text() }))), year);
            if (!r.stats.players && !r.stats.orgs) throw new Error(r.warnings[0] ?? 'aucune ligne exploitable');
            onLoad(r.db, csv.map(f => f.name).join(' + '), { warnings: r.warnings, autoLevels: r.stats.autoLevels });
          }
        } catch (err) { notify(`Import impossible : ${(err as Error).message}`, 'bad'); }
        e.target.value = '';
      }} />
      <Btn onClick={() => ref.current?.click()}>{label}</Btn>
    </>
  );
}

export function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const nations = Object.values(NATION_BY_CODE).sort((a, b) => a.name.localeCompare(b.name));

export function Editor() {
  const g = useGame();
  const notify = useStore(s => s.notify);
  const [tab, setTab] = useState<'Organisations' | 'Joueurs' | 'Sponsors'>('Organisations');
  const [q, setQ] = useState('');
  const [region, setRegion] = useState<Region | 'ALL'>('ALL');
  const [sel, setSel] = useState<string | null>(null);
  const [report, setReport] = useState<{ title: string; warnings: string[] } | null>(null);
  const [help, setHelp] = useState(false);

  const orgs = Object.values(g.orgs).filter(o => !o.disbanded && (region === 'ALL' || o.region === region) && (!q || `${o.name} ${o.tag}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.reputation - a.reputation);
  const players = Object.values(g.players).filter(p => !p.retired && (region === 'ALL' || p.region === region) && (!q || `${p.tag} ${p.firstName} ${p.lastName}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => ca(b) - ca(a)).slice(0, 150);
  const sponsors = Object.values(g.sponsors).filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Base de données" right={<span>Les fichiers restent sur votre machine et ne s'appliquent qu'à cette partie</span>}>
        <div className="flex flex-wrap gap-2 items-center">
          <DbFilePicker label="Importer CSV / JSON" onLoad={(db, fn, info) => {
            const r = act(gs => applyDatabase(gs, db));
            setReport({ title: `${fn} : ${r.orgs} organisation(s), ${r.players} joueur(s) dont ${r.created} créé(s)${info ? `, ${info.autoLevels} niveau(x) calculé(s) automatiquement` : ''}.`, warnings: [...(info?.warnings ?? []), ...r.warnings] });
            notify('Base importée.', 'good');
          }} />
          <Btn onClick={() => downloadText('rlm-joueurs.csv', PLAYERS_TEMPLATE)}>Modèle CSV joueurs</Btn>
          <Btn onClick={() => downloadText('rlm-organisations.csv', ORGS_TEMPLATE)}>Modèle CSV organisations</Btn>
          <Btn kind="ghost" onClick={() => downloadJson(`rlm-base-${g.date}.json`, exportDatabase(g))}>Exporter la base actuelle (JSON)</Btn>
          <Btn kind="ghost" onClick={() => setHelp(!help)}>{help ? "Masquer l'aide" : 'Aide CSV'}</Btn>
        </div>
        <p className="text-xs text-ink-400 mt-2">Sélectionnez les deux CSV ensemble (organisations + joueurs). Laissez « niveau » vide pour le calcul automatique.</p>
        {help && (
          <div className="mt-3 rounded-lg border border-ink-600 bg-ink-850 p-3 text-xs text-ink-200 leading-relaxed whitespace-pre-line">
            {CSV_HELP}
            <div className="mt-2 grid grid-cols-5 gap-2">{TIER_LABEL.slice(1).map((l, i) => <div key={l} className="rounded-md bg-ink-800 border border-ink-600 p-2"><div className="font-bold text-accent">Palier {i + 1}</div><div>{l}</div><div className="text-ink-400">base {TIER_BASE[i + 1]}</div></div>)}</div>
          </div>
        )}
        {report && (
          <div className="mt-3 rounded-lg border border-ink-600 bg-ink-850 p-3 text-xs">
            <div className="font-semibold text-good">{report.title}</div>
            {report.warnings.length > 0 && <><div className="mt-2 font-semibold text-warn">Rapport de cohérence ({report.warnings.length})</div><ul className="mt-1 list-disc pl-5 text-ink-300 max-h-48 overflow-auto">{report.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></>}
          </div>
        )}
      </Panel>
      <div className="flex gap-2 items-center">
        <Tabs tabs={['Organisations', 'Joueurs', 'Sponsors'] as const} value={tab} onChange={t => { setTab(t); setSel(null); }} />
        <input placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />
        {tab !== 'Sponsors' && <select value={region} onChange={e => setRegion(e.target.value as Region | 'ALL')}><option value="ALL">Toutes régions</option>{REGIONS.map(r => <option key={r} value={r}>{REGION_INFO[r].name}</option>)}</select>}
      </div>
      <div className="grid grid-cols-[1fr_420px] gap-3">
        <Panel pad={false}>
          <div className="max-h-[640px] overflow-auto">
            <table className="data"><tbody>
              {tab === 'Organisations' && orgs.map(o => <tr key={o.id} className={cx('cursor-pointer', sel === o.id && 'me')} onClick={() => setSel(o.id)}><td><span className="inline-flex items-center gap-2"><OrgBadge org={o} />{o.name}</span></td><td>{o.tag}</td><td>{o.region}</td><td className="tnum">Rép. {Math.round(o.reputation)}</td></tr>)}
              {tab === 'Joueurs' && players.map(p => <tr key={p.id} className={cx('cursor-pointer', sel === p.id && 'me')} onClick={() => setSel(p.id)}><td><Flag code={p.nationality} /> {p.tag}</td><td className="text-ink-300">{p.firstName} {p.lastName}</td><td>{p.orgId ? g.orgs[p.orgId].tag : 'Libre'}</td><td><AbilityCell g={g} p={p} /></td></tr>)}
              {tab === 'Sponsors' && sponsors.map(s => <tr key={s.id} className={cx('cursor-pointer', sel === s.id && 'me')} onClick={() => setSel(s.id)}><td>{s.name}</td><td className="text-ink-300">{s.industry}</td></tr>)}
            </tbody></table>
            {tab === 'Joueurs' && players.length === 150 && <div className="p-2 text-[11px] text-ink-400">150 premiers résultats — affinez la recherche.</div>}
          </div>
        </Panel>
        <Panel title="Modifier">
          {!sel ? <Empty>Sélectionnez un élément.</Empty> : tab === 'Organisations' ? <OrgForm key={sel} id={sel} /> : tab === 'Joueurs' ? <PlayerForm key={sel} id={sel} /> : <SponsorForm key={sel} id={sel} />}
        </Panel>
      </div>
    </div>
  );
}

function OrgForm({ id }: { id: string }) {
  const g = useGame();
  const o = g.orgs[id];
  const [f, setF] = useState({ name: o.name, tag: o.tag, c1: o.colors[0], c2: o.colors[1], country: o.country, hq: o.hq });
  const notify = useStore(s => s.notify);
  return (
    <div className="flex flex-col gap-3">
      <Field label="Nom"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Tag (2-4)"><input value={f.tag} maxLength={4} onChange={e => setF({ ...f, tag: e.target.value.toUpperCase() })} /></Field>
      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
        <Field label="Couleur principale"><input type="color" value={f.c1} onChange={e => setF({ ...f, c1: e.target.value })} className="h-8 w-full" /></Field>
        <Field label="Couleur de fond"><input type="color" value={f.c2} onChange={e => setF({ ...f, c2: e.target.value })} className="h-8 w-full" /></Field>
      </div>
      <Field label="Pays"><select value={f.country} onChange={e => setF({ ...f, country: e.target.value })}>{nations.map(n => <option key={n.code} value={n.code}>{n.name} ({n.code})</option>)}</select></Field>
      <Field label="Siège"><input value={f.hq} onChange={e => setF({ ...f, hq: e.target.value })} /></Field>
      <div className="flex items-center gap-3"><OrgBadge org={{ ...o, tag: f.tag || '?', colors: [f.c1, f.c2] }} size={40} /><span className="font-semibold">{f.name}</span></div>
      <Btn kind="primary" disabled={f.name.trim().length < 2 || f.tag.length < 2} onClick={() => { act(gs => { const x = gs.orgs[id]; x.name = f.name.trim(); x.tag = f.tag; x.colors = [f.c1, f.c2]; x.country = f.country; x.hq = f.hq; }); notify('Organisation mise à jour.', 'good'); }}>Enregistrer</Btn>
    </div>
  );
}

function PlayerForm({ id }: { id: string }) {
  const g = useGame();
  const p = g.players[id];
  const notify = useStore(s => s.notify);
  const [f, setF] = useState({ tag: p.tag, firstName: p.firstName, lastName: p.lastName, nationality: p.nationality, birthYear: +p.birth.slice(0, 4), level: Math.round(ca(p)), potential: Math.round(p.hidden.potential), position: p.position, playstyle: p.playstyle, org: p.orgId ?? '' });
  const orgs = Object.values(g.orgs).filter(o => !o.disbanded).sort((a, b) => a.name.localeCompare(b.name));
  const save = () => {
    const clash = Object.values(g.players).find(x => x !== p && !x.retired && x.tag.toLowerCase() === f.tag.trim().toLowerCase());
    if (clash) { notify(`Le pseudo ${f.tag} est déjà utilisé.`, 'bad'); return; }
    act(gs => {
      const x = gs.players[id];
      x.tag = f.tag.trim(); x.firstName = f.firstName.trim(); x.lastName = f.lastName.trim();
      if (NATION_BY_CODE[f.nationality]) { x.nationality = f.nationality; x.region = NATION_BY_CODE[f.nationality].region; }
      x.birth = `${f.birthYear}${x.birth.slice(4)}`;
      if (f.level !== Math.round(ca(x))) setLevel(x, f.level);
      x.hidden.potential = Math.max(f.potential, ca(x));
      x.position = f.position; x.playstyle = f.playstyle;
      if ((x.orgId ?? '') !== f.org) {
        if (!f.org) { leaveOrg(gs, x); x.contract = null; }
        else { const o = gs.orgs[f.org]; joinOrg(gs, x, o, 'sub'); defaultContract(gs, x, o.reputation); }
      }
    });
    notify('Joueur mis à jour.', 'good');
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 @4xl:grid-cols-3 gap-4">
        <Field label="Pseudo"><input value={f.tag} onChange={e => setF({ ...f, tag: e.target.value })} /></Field>
        <Field label="Prénom"><input value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></Field>
        <Field label="Nom"><input value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
        <Field label="Nationalité"><select value={f.nationality} onChange={e => setF({ ...f, nationality: e.target.value })}>{nations.map(n => <option key={n.code} value={n.code}>{n.name} ({n.code})</option>)}</select></Field>
        <Field label="Année de naissance"><input type="number" value={f.birthYear} onChange={e => setF({ ...f, birthYear: +e.target.value })} /></Field>
        <Field label={`Niveau : ${f.level}`}><input type="range" min={30} max={97} value={f.level} onChange={e => setF({ ...f, level: +e.target.value })} /></Field>
        <Field label={`Potentiel : ${f.potential}`}><input type="range" min={30} max={99} value={f.potential} onChange={e => setF({ ...f, potential: +e.target.value })} /></Field>
        <Field label="Poste"><select value={f.position} onChange={e => setF({ ...f, position: +e.target.value as Position })}><option value={1}>1er homme</option><option value={2}>2e homme</option><option value={3}>3e homme</option></select></Field>
        <Field label="Style"><select value={f.playstyle} onChange={e => setF({ ...f, playstyle: e.target.value as Playstyle })}>{PLAYSTYLES.map(s => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Organisation"><select value={f.org} onChange={e => setF({ ...f, org: e.target.value })}><option value="">Agent libre</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
      <div className="text-[11px] text-ink-400">Le niveau décale tous les attributs de jeu pour atteindre la valeur choisie. Changer d'organisation crée un contrat standard (statut remplaçant).</div>
      <Btn kind="primary" disabled={f.tag.trim().length < 2} onClick={save}>Enregistrer</Btn>
    </div>
  );
}

function SponsorForm({ id }: { id: string }) {
  const g = useGame();
  const s = g.sponsors[id];
  const [name, setName] = useState(s.name);
  const notify = useStore(st => st.notify);
  return (
    <div className="flex flex-col gap-3">
      <Field label="Nom de la marque"><input value={name} onChange={e => setName(e.target.value)} /></Field>
      <div className="text-xs text-ink-300">{s.industry} · budget {s.budget.toLocaleString('fr-FR')} $/mois · {s.audience}</div>
      <Btn kind="primary" disabled={name.trim().length < 2} onClick={() => { act(gs => { gs.sponsors[id].name = name.trim(); }); notify('Sponsor renommé.', 'good'); }}>Enregistrer</Btn>
    </div>
  );
}
