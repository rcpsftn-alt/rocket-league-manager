import { useState, type ReactNode } from 'react';
import type { GameState, Org, Player } from '../../engine/types';
import { useStore } from '../store';
import { flag } from '../../engine/data';
import { abilityStars, ca, fuzzy, knowledge, potentialStars } from '../../engine/player';

export function cx(...a: (string | false | null | undefined)[]) { return a.filter(Boolean).join(' '); }

export function Panel({ title, right, children, className, pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('bg-ink-900 border border-ink-700 flex flex-col min-h-0', className)}>
      {title && (
        <header className="flex items-center justify-between h-8 px-3 border-b border-ink-700 bg-ink-850 shrink-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-200">{title}</h3>
          <div className="flex items-center gap-2 text-[11px] text-ink-300">{right}</div>
        </header>
      )}
      <div className={cx('min-h-0 flex-1', pad && 'p-3')}>{children}</div>
    </section>
  );
}

export function Btn({ children, onClick, kind = 'default', small, disabled, title, className }: { children: ReactNode; onClick?: () => void; kind?: 'default' | 'primary' | 'danger' | 'ghost'; small?: boolean; disabled?: boolean; title?: string; className?: string }) {
  return (
    <button title={title} disabled={disabled} onClick={onClick} className={cx(
      'inline-flex items-center gap-1.5 font-medium border transition-colors select-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
      small ? 'h-6 px-2 text-[11px]' : 'h-7 px-3 text-xs',
      kind === 'primary' && 'bg-accent border-accent text-black hover:bg-[#ff8f3d]',
      kind === 'default' && 'bg-ink-800 border-ink-600 text-ink-100 hover:border-ink-400',
      kind === 'danger' && 'bg-transparent border-bad/60 text-bad hover:bg-bad/10',
      kind === 'ghost' && 'bg-transparent border-transparent text-ink-200 hover:text-white hover:bg-ink-800',
      className,
    )}>{children}</button>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'accent' }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className={cx('text-lg font-semibold tnum leading-tight', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', tone === 'accent' && 'text-accent')}>{value}</div>
      {sub && <div className="text-[11px] text-ink-300 truncate">{sub}</div>}
    </div>
  );
}

export function attrColor(v: number) {
  return v >= 85 ? '#3fcf8e' : v >= 72 ? '#9be15d' : v >= 60 ? '#e8d44d' : v >= 45 ? '#f0a03c' : '#f25555';
}
export function AttrValue({ g, p, v }: { g: GameState; p: Player; v: number }) {
  const [lo, hi] = fuzzy(g, p, v);
  if (lo === hi) return <span className="tnum font-semibold" style={{ color: attrColor(v) }}>{lo}</span>;
  return <span className="tnum text-ink-300">{lo}–{hi}</span>;
}
export function Bar({ value, max = 100, color, h = 4 }: { value: number; max?: number; color?: string; h?: number }) {
  return <div className="w-full bg-ink-700" style={{ height: h }}><div style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, height: h, background: color ?? attrColor(value) }} /></div>;
}

export function Stars({ n, dim }: { n: number | null; dim?: boolean }) {
  if (n == null) return <span className="text-ink-400 text-[11px]">?</span>;
  return (
    <span className={cx('inline-flex text-[11px] leading-none', dim ? 'text-ink-300' : 'text-accent')} title={`${n} / 5`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i}>{n >= i ? '★' : n >= i - 0.5 ? '⯪' : '☆'}</span>)}
    </span>
  );
}
export function AbilityCell({ g, p }: { g: GameState; p: Player }) {
  const k = knowledge(g, p);
  const c = ca(p);
  if (k >= 95) return <span className="tnum font-semibold" style={{ color: attrColor(c) }}>{Math.round(c)}</span>;
  const [lo, hi] = fuzzy(g, p, c);
  return <span className="tnum text-ink-300">{lo}–{hi}</span>;
}
export function PotCell({ g, p }: { g: GameState; p: Player }) { return <Stars n={potentialStars(g, p)} dim />; }
export function CaStars({ v }: { v: number }) { return <Stars n={abilityStars(v)} />; }

export function OrgBadge({ org, size = 18 }: { org: Org; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center font-black shrink-0 tracking-tighter" style={{ width: size, height: size, background: org.colors[1], color: org.colors[0], border: `1px solid ${org.colors[0]}55`, fontSize: size * 0.38 }}>
      {org.tag.slice(0, 3)}
    </span>
  );
}
export function OrgLink({ org, badge = true, short }: { org: Org | undefined; badge?: boolean; short?: boolean }) {
  const nav = useStore(s => s.nav);
  if (!org) return <span className="text-ink-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      {badge && <OrgBadge org={org} />}
      <span className={cx('link truncate', org.isUser && 'text-accent font-semibold')} onClick={e => { e.stopPropagation(); nav('org', org.id); }}>{short ? org.tag : org.name}</span>
    </span>
  );
}
export function PlayerLink({ p, full }: { p: Player | undefined; full?: boolean }) {
  const nav = useStore(s => s.nav);
  if (!p) return <span className="text-ink-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="text-[13px]">{flag(p.nationality)}</span>
      <span className="link font-medium truncate" onClick={e => { e.stopPropagation(); nav('player', p.id); }}>{p.tag}</span>
      {full && <span className="text-ink-400 truncate">{p.firstName} {p.lastName}</span>}
    </span>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly T[] | T[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex border-b border-ink-700 gap-0.5">
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} className={cx('px-3 h-8 text-xs font-medium border-b-2 -mb-px cursor-pointer', value === t ? 'border-accent text-white' : 'border-transparent text-ink-300 hover:text-white')}>{t}</button>
      ))}
    </div>
  );
}

export function Modal({ title, children, onClose, width = 560 }: { title: ReactNode; children: ReactNode; onClose: () => void; width?: number }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-ink-900 border border-ink-600 shadow-2xl slidein max-h-[90vh] flex flex-col" style={{ width }} onMouseDown={e => e.stopPropagation()}>
        <header className="h-10 px-4 flex items-center justify-between border-b border-ink-700 bg-ink-850">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button className="text-ink-300 hover:text-white cursor-pointer" onClick={onClose}>✕</button>
        </header>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export function useSort<T>(rows: T[], init: { key: string; dir: 1 | -1 }, getters: Record<string, (r: T) => number | string>) {
  const [s, setS] = useState(init);
  const get = getters[s.key];
  const sorted = get ? [...rows].sort((a, b) => { const x = get(a), y = get(b); return (x < y ? -1 : x > y ? 1 : 0) * s.dir; }) : rows;
  const th = (key: string, label: ReactNode, cls?: string) => (
    <th className={cx('sortable', cls)} onClick={() => setS(c => ({ key, dir: c.key === key ? (c.dir === 1 ? -1 : 1) : -1 }))}>
      {label}{s.key === key ? (s.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );
  return { sorted, th };
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn' | 'accent' | 'info' }) {
  return <span className={cx('inline-block px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide border',
    tone === 'default' && 'border-ink-500 text-ink-200', tone === 'good' && 'border-good/50 text-good', tone === 'bad' && 'border-bad/50 text-bad',
    tone === 'warn' && 'border-warn/50 text-warn', tone === 'accent' && 'border-accent/60 text-accent', tone === 'info' && 'border-info/50 text-info')}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) { return <div className="text-ink-400 text-xs py-6 text-center">{children}</div>; }

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wider text-ink-400">{label}</span>{children}</label>;
}

export function moraleLabel(v: number) { return v >= 80 ? 'Excellent' : v >= 65 ? 'Bon' : v >= 45 ? 'Correct' : v >= 30 ? 'Faible' : 'Très faible'; }
export function moraleTone(v: number): 'good' | 'warn' | 'bad' | 'default' { return v >= 65 ? 'good' : v >= 45 ? 'default' : v >= 30 ? 'warn' : 'bad'; }
export function CondDot({ p }: { p: Player }) {
  const c = p.cond;
  const injured = !!c.injuredUntil;
  const col = injured ? '#f25555' : c.fatigue > 70 ? '#f0a03c' : c.fatigue > 45 ? '#e8d44d' : '#3fcf8e';
  return <span title={injured ? `Indisponible jusqu'au ${c.injuredUntil}` : `Fatigue ${Math.round(c.fatigue)}%`} className="inline-block w-2 h-2 rounded-full" style={{ background: col }} />;
}
