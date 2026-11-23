import type { GameState, NewsItem } from './types';
import { newId } from './util';

export function addNews(g: GameState, n: Omit<NewsItem, 'id' | 'date' | 'read'> & { date?: string }) {
  const item: NewsItem = { id: newId(g, 'n'), date: n.date ?? g.date, read: false, ...n } as NewsItem;
  g.news.unshift(item);
  if (g.news.length > 400) g.news.length = 400;
  return item;
}

export function inbox(g: GameState, title: string, body: string, action?: { kind: 'offer' | 'screen'; id: string }) {
  g.inbox.unshift({ id: newId(g, 'i'), date: g.date, title, body, read: false, action });
  if (g.inbox.length > 150) g.inbox.length = 150;
}
