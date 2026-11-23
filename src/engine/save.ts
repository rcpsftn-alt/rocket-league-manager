// Persistence layer: IndexedDB (structured clone) via idb-keyval.
// The repository API (list/load/save/delete) is storage-agnostic so it can be
// swapped for a SQLite/PostgreSQL backend without touching the game code.
import { get, set, del } from 'idb-keyval';
import type { GameState } from './types';

export interface SaveMeta { id: string; name: string; manager: string; org: string; date: string; season: number; updatedAt: string; difficulty: string }
const INDEX = 'rlm:index';

export async function listSaves(): Promise<SaveMeta[]> {
  return ((await get(INDEX)) as SaveMeta[] | undefined)?.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) ?? [];
}
export async function saveGame(g: GameState): Promise<void> {
  await set(`rlm:save:${g.saveId}`, g);
  const idx = (await listSaves()).filter(s => s.id !== g.saveId);
  idx.push({ id: g.saveId, name: g.saveName, manager: g.manager.name, org: g.userOrgId ? g.orgs[g.userOrgId].name : 'Sans club', date: g.date, season: g.season, updatedAt: new Date().toISOString(), difficulty: g.difficulty });
  await set(INDEX, idx);
}
export async function loadGame(id: string): Promise<GameState | undefined> {
  return (await get(`rlm:save:${id}`)) as GameState | undefined;
}
export async function deleteSave(id: string): Promise<void> {
  await del(`rlm:save:${id}`);
  await set(INDEX, (await listSaves()).filter(s => s.id !== id));
}
