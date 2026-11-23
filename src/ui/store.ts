import { create } from 'zustand';
import type { GameState } from '../engine/types';
import { saveGame } from '../engine/save';
import { rngGet, rngSet } from '../engine/util';

export type Screen =
  | 'dashboard' | 'inbox' | 'squad' | 'player' | 'org' | 'database' | 'transfers' | 'scouting' | 'tactics' | 'training'
  | 'staff' | 'competitions' | 'tournament' | 'schedule' | 'match' | 'finances' | 'sponsors' | 'social' | 'news'
  | 'club' | 'rankings' | 'history' | 'settings';

interface Route { screen: Screen; id?: string }

interface Store {
  g: GameState | null;
  v: number;               // bumped after every engine mutation to re-render
  route: Route;
  stack: Route[];
  saving: boolean;
  toast: { text: string; kind: 'info' | 'good' | 'bad'; id: number } | null;
  setGame: (g: GameState | null) => void;
  bump: () => void;
  nav: (screen: Screen, id?: string) => void;
  back: () => void;
  notify: (text: string, kind?: 'info' | 'good' | 'bad') => void;
}

export const useStore = create<Store>((set, get) => ({
  g: null, v: 0, route: { screen: 'dashboard' }, stack: [], saving: false, toast: null,
  setGame: g => set({ g, v: get().v + 1, route: { screen: 'dashboard' }, stack: [] }),
  bump: () => set({ v: get().v + 1 }),
  nav: (screen, id) => { const r = get().route; if (r.screen === screen && r.id === id) return; set({ route: { screen, id }, stack: [...get().stack.slice(-30), r] }); },
  back: () => { const s = get().stack; if (!s.length) return; set({ route: s[s.length - 1], stack: s.slice(0, -1) }); },
  notify: (text, kind = 'info') => set({ toast: { text, kind, id: Date.now() } }),
}));

/** Hook returning the current game (re-renders on every mutation). */
export function useGame(): GameState {
  const g = useStore(s => s.g);
  useStore(s => s.v);
  return g!;
}

/**
 * Run an engine mutation with the game's RNG stream, then re-render and
 * optionally persist. All UI-triggered game actions go through this.
 */
export function act<T>(fn: (g: GameState) => T, opts: { save?: boolean } = { save: true }): T {
  const st = useStore.getState();
  const g = st.g!;
  rngSet(g.rngState);
  const r = fn(g);
  g.rngState = rngGet();
  st.bump();
  if (opts.save !== false) persist();
  return r;
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function persist(immediate = false) {
  const g = useStore.getState().g;
  if (!g || !g.settings.autosave && !immediate) return;
  if (timer) clearTimeout(timer);
  const run = async () => {
    useStore.setState({ saving: true });
    try { await saveGame(g); } catch (e) { console.error(e); useStore.getState().notify('Échec de la sauvegarde', 'bad'); }
    useStore.setState({ saving: false });
  };
  if (immediate) return run();
  timer = setTimeout(run, 1200);
}
