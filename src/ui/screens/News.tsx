import { useState } from 'react';
import { useGame, useStore, act, persist } from '../store';
import type { NewsItem } from '../../engine/types';
import { Btn, cx, Empty, Field, OrgLink, Panel, Pill, PlayerLink } from '../components/ui';
import { fmtDate } from '../../engine/util';
import { DIFFICULTY } from '../../engine/data';

const KINDS: Record<NewsItem['kind'], string> = { transfer: 'Transferts', result: 'Résultats', rumor: 'Rumeurs', finance: 'Finances', club: 'Clubs', player: 'Joueurs', sponsor: 'Sponsors', board: 'Board', world: 'Scène' };

export function News() {
  const g = useGame();
  const [kind, setKind] = useState<NewsItem['kind'] | 'all' | 'mine'>('all');
  const list = g.news.filter(n => kind === 'all' || (kind === 'mine' ? (g.userOrgId && n.orgIds.includes(g.userOrgId)) : n.kind === kind));
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex gap-1 flex-wrap">
        <Btn small kind={kind === 'all' ? 'primary' : 'default'} onClick={() => setKind('all')}>Tout</Btn>
        {g.userOrgId && <Btn small kind={kind === 'mine' ? 'primary' : 'default'} onClick={() => setKind('mine')}>Mon club</Btn>}
        {(Object.keys(KINDS) as NewsItem['kind'][]).map(k => <Btn key={k} small kind={kind === k ? 'primary' : 'default'} onClick={() => setKind(k)}>{KINDS[k]}</Btn>)}
      </div>
      <Panel pad={false}>
        {!list.length && <Empty>Aucune actualité.</Empty>}
        {list.slice(0, 200).map(n => (
          <article key={n.id} className="px-4 py-3 border-b border-ink-800">
            <div className="flex items-center gap-2 mb-1">
              <Pill tone={n.kind === 'rumor' ? 'warn' : n.kind === 'result' ? 'info' : n.kind === 'transfer' ? 'accent' : 'default'}>{KINDS[n.kind]}</Pill>
              <span className="text-[11px] text-ink-400">{fmtDate(n.date)}</span>
              {n.kind === 'rumor' && <span className="text-[10px] text-ink-500 italic">non confirmé</span>}
            </div>
            <h3 className={cx('font-semibold text-[14px]', n.important && 'text-accent')}>{n.title}</h3>
            <p className="text-ink-300 text-xs mt-0.5">{n.body}</p>
            {(n.orgIds.length > 0 || n.playerIds.length > 0) && <div className="flex gap-3 mt-1 text-xs">{n.orgIds.slice(0, 3).map(id => g.orgs[id] && <OrgLink key={id} org={g.orgs[id]} />)}{n.playerIds.slice(0, 3).map(id => g.players[id] && <PlayerLink key={id} p={g.players[id]} />)}</div>}
          </article>
        ))}
      </Panel>
    </div>
  );
}

export function Settings() {
  const g = useGame();
  const { setGame, notify } = useStore();
  const [name, setName] = useState(g.saveName);
  return (
    <div className="p-3 grid grid-cols-2 gap-3 max-w-4xl">
      <Panel title="Sauvegarde">
        <div className="flex flex-col gap-3">
          <Field label="Nom de la sauvegarde"><input value={name} onChange={e => setName(e.target.value)} onBlur={() => act(gs => { gs.saveName = name; })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={g.settings.autosave} onChange={e => act(gs => { gs.settings.autosave = e.target.checked; })} /> Sauvegarde automatique après chaque action importante</label>
          <div className="flex gap-2">
            <Btn kind="primary" onClick={async () => { await persist(true); notify('Partie sauvegardée.', 'good'); }}>Sauvegarder maintenant</Btn>
            <Btn onClick={async () => { await persist(true); setGame(null); }}>Sauvegarder et quitter</Btn>
          </div>
        </div>
      </Panel>
      <Panel title="Partie">
        <div className="text-sm flex flex-col gap-1">
          <div>Difficulté : <b>{DIFFICULTY[g.difficulty].label}</b></div>
          <div>Graine du monde : <span className="font-mono text-ink-300">{g.seed}</span></div>
          <div>Joueurs suivis : {Object.keys(g.players).length} · Organisations : {Object.values(g.orgs).filter(o => !o.disbanded).length}</div>
          <div>Créée le {new Date(g.createdAt).toLocaleDateString('fr-FR')}</div>
        </div>
      </Panel>
      <Panel title="À propos" className="col-span-2">
        <div className="text-xs text-ink-300 leading-relaxed">Rocket League Manager est une simulation fictive : organisations, joueurs, sponsors et tournois sont générés. Le moteur de match simule chaque jeu phase par phase à partir des attributs, de la forme, de la fatigue, du moral, de la chimie et des consignes tactiques. Toutes les statistiques affichées proviennent de la simulation.</div>
      </Panel>
    </div>
  );
}
