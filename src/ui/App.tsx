import { useEffect, useState } from 'react';
import { useStore, useGame, act, persist, type Screen } from './store';
import { cx, OrgBadge, Btn } from './components/ui';
import { fmtDate, money } from '../engine/util';
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
import { userNextMatch } from '../engine/competitions';

const NAV: { group: string; items: [Screen, string][] }[] = [
  { group: 'Accueil', items: [['dashboard', 'Tableau de bord'], ['inbox', 'Messagerie'], ['news', 'Actualités']] },
  { group: 'Équipe', items: [['squad', 'Effectif'], ['tactics', 'Tactique'], ['training', 'Entraînement'], ['staff', 'Staff']] },
  { group: 'Recrutement', items: [['database', 'Base joueurs'], ['transfers', 'Transferts'], ['scouting', 'Scouting']] },
  { group: 'Compétition', items: [['schedule', 'Calendrier'], ['competitions', 'Compétitions'], ['rankings', 'Classements'], ['history', 'Historique']] },
  { group: 'Organisation', items: [['finances', 'Finances'], ['sponsors', 'Sponsors'], ['social', 'Réseaux sociaux'], ['club', 'Club & board'], ['settings', 'Paramètres']] },
];
const NEED_ORG: Screen[] = ['squad', 'tactics', 'training', 'staff', 'finances', 'sponsors', 'social', 'transfers'];

function Sidebar() {
  const g = useGame();
  const { route, nav } = useStore();
  const unread = g.inbox.filter(i => !i.read).length;
  return (
    <nav className="w-48 shrink-0 bg-ink-900 border-r border-ink-700 overflow-y-auto">
      <div className="h-12 flex items-center gap-2 px-3 border-b border-ink-700">
        <div className="w-6 h-6 bg-accent text-black font-black text-[10px] flex items-center justify-center">RLM</div>
        <div className="leading-tight"><div className="text-[11px] font-bold tracking-wider">ROCKET LEAGUE</div><div className="text-[10px] text-ink-400 tracking-[0.2em]">MANAGER</div></div>
      </div>
      {NAV.map(sec => (
        <div key={sec.group} className="py-1.5">
          <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-ink-500">{sec.group}</div>
          {sec.items.map(([s, label]) => {
            const disabled = !g.userOrgId && NEED_ORG.includes(s);
            return (
              <button key={s} disabled={disabled} onClick={() => nav(s)} className={cx('w-full text-left px-3 h-7 text-[12.5px] flex items-center justify-between border-l-2 cursor-pointer disabled:opacity-30 disabled:cursor-default',
                route.screen === s ? 'border-accent bg-ink-800 text-white' : 'border-transparent text-ink-200 hover:bg-ink-850 hover:text-white')}>
                {label}
                {s === 'inbox' && unread > 0 && <span className="text-[10px] bg-accent text-black px-1.5 font-bold">{unread}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function TopBar() {
  const g = useGame();
  const { nav, back, stack, saving, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const org = g.userOrgId ? g.orgs[g.userOrgId] : null;
  const pending = g.pendingUserMatch ? g.matches[g.pendingUserMatch] : null;
  const next = userNextMatch(g);

  const run = (mode: 'event' | 'day' | 'match') => {
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

  return (
    <header className="h-12 shrink-0 bg-ink-900 border-b border-ink-700 flex items-center px-3 gap-4">
      <Btn kind="ghost" small onClick={back} disabled={!stack.length}>←</Btn>
      {org ? (
        <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => nav('org', org.id)}>
          <OrgBadge org={org} size={26} />
          <div className="leading-tight min-w-0">
            <div className="font-semibold truncate">{org.name}</div>
            <div className="text-[11px] text-ink-400">{g.manager.name} · Manager</div>
          </div>
        </div>
      ) : <div className="text-ink-300">{g.manager.name} · <span className="text-warn">Sans club</span></div>}
      <div className="flex-1" />
      <div className={cx('text-[11px] px-2 py-0.5 border', transferWindowOpen(g) ? 'border-good/40 text-good' : 'border-ink-600 text-ink-400')}>{windowLabel(g)}</div>
      {org && <div className="text-right leading-tight"><div className="text-[10px] uppercase text-ink-400">Trésorerie</div><div className={cx('tnum font-semibold', org.balance < 0 ? 'text-bad' : 'text-ink-100')}>{money(org.balance)}</div></div>}
      <div className="text-right leading-tight w-40">
        <div className="text-[10px] uppercase text-ink-400">Saison {g.season}{saving ? ' · sauvegarde…' : ''}</div>
        <div className="font-semibold">{fmtDate(g.date, true)}</div>
      </div>
      <div className="flex items-stretch">
        <button onClick={() => run('event')} disabled={busy || g.gameOver} className="h-9 px-5 bg-accent text-black font-bold text-sm hover:bg-[#ff8f3d] disabled:opacity-50 cursor-pointer">
          {busy ? '…' : pending && !pending.played ? 'JOUER LE MATCH' : 'CONTINUER ›'}
        </button>
        <div className="flex flex-col">
          <button title="Avancer d'un jour" onClick={() => run('day')} disabled={busy} className="h-[18px] px-2 text-[10px] bg-ink-700 hover:bg-ink-600 border-l border-ink-950 cursor-pointer">+1 J</button>
          <button title={next ? `Prochain match : ${next.date}` : 'Avancer jusqu\'au prochain match'} onClick={() => run('match')} disabled={busy} className="h-[18px] px-2 text-[10px] bg-ink-700 hover:bg-ink-600 border-l border-t border-ink-950 cursor-pointer">MATCH</button>
        </div>
      </div>
    </header>
  );
}

function Toast() {
  const toast = useStore(s => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => { if (!toast) return; setShow(true); const t = setTimeout(() => setShow(false), 3500); return () => clearTimeout(t); }, [toast]);
  if (!toast || !show) return null;
  return <div className={cx('fixed bottom-4 right-4 z-[60] px-4 py-2 border text-sm slidein max-w-md shadow-xl', toast.kind === 'good' ? 'bg-[#0f2a1d] border-good/50' : toast.kind === 'bad' ? 'bg-[#2a1010] border-bad/50' : 'bg-ink-800 border-ink-500')}>{toast.text}</div>;
}

function Router() {
  const { route } = useStore();
  const g = useGame();
  if (g.gameOver) return <GameOver />;
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
  }
}

function GameOver() {
  const g = useGame();
  return <div className="p-10 text-center"><h1 className="text-3xl font-bold text-bad mb-2">Fin de carrière</h1><p className="text-ink-300 mb-6">{g.inbox[0]?.body}</p><Btn kind="primary" onClick={() => useStore.getState().setGame(null)}>Menu principal</Btn></div>;
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
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto bg-ink-950"><Router /></main>
      </div>
      <NegotiationHost />
      <Toast />
    </div>
  );
}
