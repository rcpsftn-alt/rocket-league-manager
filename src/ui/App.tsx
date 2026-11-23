import { useEffect, useRef, useState } from 'react';
import { useStore, useGame, act, persist, type Screen } from './store';
import { cx, OrgBadge, Btn, PageHeader } from './components/ui';
import { Icon } from './components/icons';
import { fmtDate, money, fmtShortDate } from '../engine/util';
import { advanceDay, advanceUntilEvent } from '../engine/advance';
import { windowLabel, transferWindowOpen } from '../engine/transfers';
import { StartMenu } from './screens/Start';
import { Dashboard, Inbox } from './screens/Dashboard';
import { Squad, PlayerProfile, OrgProfile, NegotiationHost } from './screens/Squad';
import { Database, Transfers, Scouting } from './screens/Market';
import { Tactics, Training, StaffScreen } from './screens/Team';
import { Competitions, TournamentView, Schedule, Rankings, History } from './screens/Competitions';
import { MatchScreen } from './screens/Match';
import { Finances, Sponsors, Social, Club } from './screens/Business';
import { News, Settings } from './screens/News';
import { Editor } from './screens/Editor';
import { userNextMatch } from '../engine/competitions';

const NAV: { group: string; items: [Screen, string][] }[] = [
  { group: 'Accueil', items: [['dashboard', 'Tableau de bord'], ['inbox', 'Messagerie'], ['news', 'Actualités']] },
  { group: 'Équipe', items: [['squad', 'Effectif'], ['tactics', 'Tactique'], ['training', 'Entraînement'], ['staff', 'Staff']] },
  { group: 'Recrutement', items: [['database', 'Base joueurs'], ['transfers', 'Transferts'], ['scouting', 'Scouting']] },
  { group: 'Compétition', items: [['schedule', 'Calendrier'], ['competitions', 'Compétitions'], ['rankings', 'Classements'], ['history', 'Historique']] },
  { group: 'Organisation', items: [['finances', 'Finances'], ['sponsors', 'Sponsors'], ['social', 'Réseaux sociaux'], ['club', 'Club & board'], ['editor', 'Éditeur'], ['settings', 'Paramètres']] },
];
const NEED_ORG: Screen[] = ['squad', 'tactics', 'training', 'staff', 'finances', 'sponsors', 'social', 'transfers'];
const TITLES: Partial<Record<Screen, [string, string]>> = {
  dashboard: ['Tableau de bord', 'Vue d\'ensemble de votre organisation'], inbox: ['Messagerie', 'Messages du staff, du board et des clubs'], news: ['Actualités', 'Ce qui se passe sur la scène'],
  squad: ['Effectif', 'Roster, statuts, condition et contrats'], tactics: ['Tactique', 'Consignes de jeu et postes'], training: ['Entraînement', 'Programme collectif et plans individuels'], staff: ['Staff', 'Votre équipe technique et le marché'],
  database: ['Base joueurs', 'Recherche avancée sur toute la scène'], transfers: ['Transferts', 'Offres, shortlist et mercato'], scouting: ['Scouting', 'Recruteurs, connaissance et pépites'],
  schedule: ['Calendrier', 'Votre saison jour par jour'], competitions: ['Compétitions', 'Le circuit RLCS'], rankings: ['Classements', 'Équipes, points et joueurs'], history: ['Historique', 'Palmarès, records et carrière'],
  finances: ['Finances', 'Trésorerie, budget et compte de résultat'], sponsors: ['Sponsors', 'Partenariats et démarchage'], social: ['Réseaux sociaux', 'Audience, campagnes et communauté'], club: ['Club & board', 'Objectifs, infrastructures et identité'],
  editor: ['Éditeur', 'Renommer, ajuster et importer une base de données'], settings: ['Paramètres', 'Sauvegarde et informations'],
};

function useNarrow(px: number) {
  const [n, setN] = useState(() => window.innerWidth < px);
  useEffect(() => { const h = () => setN(window.innerWidth < px); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, [px]);
  return n;
}

function Sidebar() {
  const g = useGame();
  const { route, nav } = useStore();
  const narrow = useNarrow(1180);
  const [pinned, setPinned] = useState<boolean | null>(null);
  const collapsed = pinned ?? narrow;
  const unread = g.inbox.filter(i => !i.read).length;
  return (
    <nav className={cx('shrink-0 bg-ink-900/80 border-r border-ink-700 overflow-y-auto overflow-x-hidden flex flex-col transition-[width] duration-200', collapsed ? 'w-[68px]' : 'w-60')}>
      <div className={cx('h-16 flex items-center gap-3 border-b border-ink-700 shrink-0', collapsed ? 'justify-center' : 'px-4')}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-[#ff5a1f] text-[#1a0d00] font-black text-[11px] flex items-center justify-center shadow-[0_6px_20px_-8px_#ff8a1f]">RLM</div>
        {!collapsed && <div className="leading-tight"><div className="text-[13px] font-extrabold tracking-wide">ROCKET LEAGUE</div><div className="text-[10px] text-ink-400 tracking-[0.3em]">MANAGER</div></div>}
      </div>
      <div className="flex-1 py-2">
        {NAV.map(sec => (
          <div key={sec.group} className="py-1.5">
            {!collapsed ? <div className="px-5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{sec.group}</div> : <div className="mx-4 my-2 border-t border-ink-700" />}
            {sec.items.map(([s, label]) => {
              const disabled = !g.userOrgId && NEED_ORG.includes(s);
              const active = route.screen === s;
              return (
                <button key={s} title={collapsed ? label : undefined} disabled={disabled} onClick={() => nav(s)} className={cx('relative flex items-center gap-3 h-9 text-[13.5px] rounded-lg cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-default',
                  collapsed ? 'w-11 mx-auto justify-center' : 'w-[calc(100%-16px)] mx-2 px-3',
                  active ? 'bg-accent/12 text-white font-semibold' : 'text-ink-300 hover:bg-ink-800 hover:text-white')}>
                  {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent" />}
                  <Icon name={s} className={cx('w-[18px] h-[18px] shrink-0', active ? 'text-accent' : '')} />
                  {!collapsed && <span className="truncate">{label}</span>}
                  {s === 'inbox' && unread > 0 && <span className={cx('text-[10px] bg-accent text-[#1a0d00] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center', collapsed ? 'absolute -top-1 -right-1' : 'ml-auto')}>{unread}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <button onClick={() => setPinned(!collapsed)} className="h-10 border-t border-ink-700 text-ink-400 hover:text-white cursor-pointer flex items-center justify-center gap-2 text-xs shrink-0">
        <Icon name={collapsed ? 'expand' : 'collapse'} className="w-4 h-4" />{!collapsed && 'Réduire'}
      </button>
    </nav>
  );
}

function TopBar() {
  const g = useGame();
  const { nav, back, stack, saving, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const org = g.userOrgId ? g.orgs[g.userOrgId] : null;
  const pending = g.pendingUserMatch ? g.matches[g.pendingUserMatch] : null;
  const next = userNextMatch(g);
  useEffect(() => { const h = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  const run = (mode: 'event' | 'day' | 'match') => {
    setMenu(false);
    if (pending && !pending.played) { nav('match', pending.id); return; }
    setBusy(true);
    setTimeout(() => {
      const r = act(gs => {
        if (mode === 'day') return advanceDay(gs);
        if (mode === 'match') { for (let i = 0; i < 120; i++) { const x = advanceDay(gs); if (x) return x; } return null; }
        return advanceUntilEvent(gs, 7);
      });
      setBusy(false);
      if (r === 'match' && useStore.getState().g!.pendingUserMatch) nav('match', useStore.getState().g!.pendingUserMatch!);
      else if (r === 'event') { notify('Un événement requiert votre attention', 'info'); nav('inbox'); }
      else if (r === 'gameover') notify('Fin de carrière.', 'bad');
    }, 10);
  };
  const isMatch = !!(pending && !pending.played);

  return (
    <header className="h-16 shrink-0 bg-ink-900/70 backdrop-blur border-b border-ink-700 flex items-center px-4 gap-3 min-w-0">
      <button onClick={back} disabled={!stack.length} title="Retour" className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-300 hover:bg-ink-800 hover:text-white disabled:opacity-30 cursor-pointer shrink-0"><Icon name="back" className="w-5 h-5" /></button>
      {org ? (
        <button className="flex items-center gap-3 min-w-0 cursor-pointer rounded-lg px-2 py-1 hover:bg-ink-800" onClick={() => nav('org', org.id)}>
          <OrgBadge org={org} size={36} />
          <div className="leading-tight min-w-0 text-left">
            <div className="font-bold truncate text-[15px]">{org.name}</div>
            <div className="text-xs text-ink-400 truncate">{g.manager.name}</div>
          </div>
        </button>
      ) : <div className="text-ink-300 text-sm">{g.manager.name} · <span className="text-warn">Sans club</span></div>}
      <div className="flex-1" />
      <div title={windowLabel(g)} className={cx('hidden md:flex items-center gap-2 text-xs font-medium px-3 h-8 rounded-full border whitespace-nowrap', transferWindowOpen(g) ? 'border-good/30 text-good bg-good/5' : 'border-ink-600 text-ink-400')}>
        <span className={cx('w-1.5 h-1.5 rounded-full', transferWindowOpen(g) ? 'bg-good' : 'bg-ink-500')} />Mercato {transferWindowOpen(g) ? 'ouvert' : 'fermé'}
      </div>
      {org && <div className="hidden sm:block text-right leading-tight px-2"><div className="text-[10px] font-medium uppercase tracking-wider text-ink-400">Trésorerie</div><div className={cx('tnum font-bold', org.balance < 0 ? 'text-bad' : 'text-ink-100')}>{money(org.balance)}</div></div>}
      <div className="text-right leading-tight px-2 whitespace-nowrap">
        <div className="text-[10px] font-medium uppercase tracking-wider text-ink-400">Saison {g.season}{saving ? ' · ✓' : ''}</div>
        <div className="font-bold">{fmtDate(g.date, true)}</div>
      </div>
      <div className="relative flex shrink-0" ref={menuRef}>
        <button onClick={() => run('event')} disabled={busy || g.gameOver} className={cx('h-10 pl-5 pr-4 rounded-l-xl font-extrabold text-sm tracking-wide cursor-pointer disabled:opacity-60 flex items-center gap-2 whitespace-nowrap transition-all hover:brightness-110',
          isMatch ? 'bg-gradient-to-r from-[#3d8bff] to-[#2563eb] text-white' : 'bg-gradient-to-r from-accent to-[#ff6a1f] text-[#1a0d00]')}>
          {busy ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Icon name={isMatch ? 'play' : 'next'} className="w-4 h-4" />}
          {isMatch ? 'Jouer le match' : 'Continuer'}
        </button>
        <button onClick={() => setMenu(!menu)} disabled={busy} className={cx('h-10 w-9 rounded-r-xl border-l border-black/20 cursor-pointer flex items-center justify-center', isMatch ? 'bg-[#2563eb] text-white' : 'bg-[#ff6a1f] text-[#1a0d00]')}><Icon name="chevron" className="w-4 h-4" /></button>
        {menu && (
          <div className="absolute right-0 top-12 w-64 card p-1.5 z-40 slidein">
            <button onClick={() => run('day')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-700 cursor-pointer"><div className="font-semibold text-sm">Avancer d'un jour</div><div className="text-xs text-ink-400">Jour par jour</div></button>
            <button onClick={() => run('event')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-700 cursor-pointer"><div className="font-semibold text-sm">Continuer (7 jours max)</div><div className="text-xs text-ink-400">S'arrête au prochain événement</div></button>
            <button onClick={() => run('match')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-700 cursor-pointer"><div className="font-semibold text-sm">Jusqu'au prochain match</div><div className="text-xs text-ink-400">{next ? `${fmtShortDate(next.date)} · ${next.label}` : 'Aucun match programmé'}</div></button>
          </div>
        )}
      </div>
    </header>
  );
}

function Toast() {
  const toast = useStore(s => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => { if (!toast) return; setShow(true); const t = setTimeout(() => setShow(false), 3800); return () => clearTimeout(t); }, [toast]);
  if (!toast || !show) return null;
  return (
    <div className={cx('fixed bottom-5 right-5 z-[60] pl-4 pr-5 py-3 rounded-xl border text-sm slidein max-w-md shadow-2xl backdrop-blur flex items-start gap-3', toast.kind === 'good' ? 'bg-[#0e2a20]/95 border-good/40' : toast.kind === 'bad' ? 'bg-[#2a1212]/95 border-bad/40' : 'bg-ink-800/95 border-ink-500')}>
      <span className={cx('mt-1 w-2 h-2 rounded-full shrink-0', toast.kind === 'good' ? 'bg-good' : toast.kind === 'bad' ? 'bg-bad' : 'bg-info')} />
      {toast.text}
    </div>
  );
}

function Screen() {
  const { route } = useStore();
  switch (route.screen) {
    case 'dashboard': return <Dashboard />;
    case 'inbox': return <Inbox />;
    case 'squad': return <Squad />;
    case 'player': return <PlayerProfile id={route.id!} />;
    case 'org': return <OrgProfile id={route.id!} />;
    case 'database': return <Database />;
    case 'transfers': return <Transfers />;
    case 'scouting': return <Scouting />;
    case 'tactics': return <Tactics />;
    case 'training': return <Training />;
    case 'staff': return <StaffScreen />;
    case 'competitions': return <Competitions />;
    case 'tournament': return <TournamentView id={route.id!} />;
    case 'schedule': return <Schedule />;
    case 'match': return <MatchScreen id={route.id!} />;
    case 'finances': return <Finances />;
    case 'sponsors': return <Sponsors />;
    case 'social': return <Social />;
    case 'club': return <Club />;
    case 'rankings': return <Rankings />;
    case 'history': return <History />;
    case 'news': return <News />;
    case 'settings': return <Settings />;
    case 'editor': return <Editor />;
  }
}

function Router() {
  const { route } = useStore();
  const g = useGame();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [route.screen, route.id]);
  if (g.gameOver) return <main className="flex-1"><GameOver /></main>;
  const t = TITLES[route.screen];
  return (
    <main ref={ref} className="flex-1 min-w-0 overflow-auto @container">
      <div key={route.screen + (route.id ?? '')} className="page max-w-[1680px] mx-auto px-6 py-5">
        {t && <PageHeader title={t[0]} subtitle={t[1]} />}
        <Screen />
      </div>
    </main>
  );
}

function GameOver() {
  const g = useGame();
  return <div className="p-16 text-center"><h1 className="text-4xl font-black text-bad mb-3">Fin de carrière</h1><p className="text-ink-300 mb-8">{g.inbox[0]?.body}</p><Btn kind="primary" onClick={() => useStore.getState().setGame(null)}>Menu principal</Btn></div>;
}

export default function App() {
  const g = useStore(s => s.g);
  useEffect(() => {
    const h = () => { if (useStore.getState().g) persist(true); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);
  if (!g) return (<><StartMenu /><Toast /></>);
  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <Router />
      </div>
      <NegotiationHost />
      <Toast />
    </div>
  );
}
