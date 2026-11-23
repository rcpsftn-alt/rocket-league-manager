import { useState, type ReactNode } from 'react';
import type { GameState, Org, Player } from '../../engine/types';
import { useStore } from '../store';
import { NATION_BY_CODE } from '../../engine/data';
import { abilityStars, ca, fuzzy, knowledge, potentialStars } from '../../engine/player';

export function cx(...a: (string | false | null | undefined)[]) { return a.filter(Boolean).join(' '); }

// ---------------------------------------------------------------- layout
export function Panel({ title, right, children, className, pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('card flex flex-col min-h-0 min-w-0 overflow-hidden', className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 shrink-0">
          <h3 className="text-[13px] font-semibold text-ink-100 tracking-tight flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-accent" />{title}</h3>
          <div className="flex items-center gap-2 text-xs text-ink-300">{right}</div>
        </header>
      )}
      <div className={cx('min-h-0 flex-1', pad ? 'px-4 pb-4' : 'tbl-wrap', !title && pad && 'pt-4', !pad && !!title && 'border-t border-ink-700')}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight leading-tight">{title}</h1>
        {subtitle && <div className="text-sm text-ink-300 mt-0.5">{subtitle}</div>}
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );
}

export function Btn({ children, onClick, kind = 'default', small, disabled, title, className }: { children: ReactNode; onClick?: () => void; kind?: 'default' | 'primary' | 'danger' | 'ghost'; small?: boolean; disabled?: boolean; title?: string; className?: string }) {
  return (
    <button title={title} disabled={disabled} onClick={onClick} className={cx(
      'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all select-none whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[.98]',
      small ? 'h-7 px-2.5 text-xs' : 'h-9 px-4 text-[13px]',
      kind === 'primary' && 'bg-accent text-[#1a0d00] hover:brightness-110 shadow-[0_4px_14px_-6px_#ff8a1f]',
      kind === 'default' && 'bg-ink-800 border border-ink-600 text-ink-100 hover:border-ink-400 hover:bg-ink-700',
      kind === 'danger' && 'bg-bad/10 border border-bad/40 text-bad hover:bg-bad/20',
      kind === 'ghost' && 'bg-transparent text-ink-200 hover:text-white hover:bg-ink-800',
      className,
    )}>{children}</button>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'accent' }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400 truncate">{label}</div>
      <div className={cx('text-[22px] font-bold tnum leading-tight mt-0.5 truncate', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', tone === 'accent' && 'text-accent')}>{value}</div>
      {sub && <div className="text-xs text-ink-300 truncate mt-0.5" title={typeof sub === 'string' ? sub : undefined}>{sub}</div>}
    </div>
  );
}

export function Kpis({ children }: { children: ReactNode }) { return <section className="card overflow-hidden"><div className="kpis">{children}</div></section>; }

// ---------------------------------------------------------------- values
export function attrColor(v: number) {
  return v >= 85 ? '#34d399' : v >= 75 ? '#a3e635' : v >= 65 ? '#facc15' : v >= 50 ? '#fb923c' : '#f87171';
}
export function RatingChip({ v, range, size = 'md' }: { v: number; range?: [number, number]; size?: 'sm' | 'md' }) {
  if (range && range[0] !== range[1]) return <span className={cx('inline-flex items-center justify-center rounded-md tnum font-semibold text-ink-300 bg-ink-800 border border-ink-600 border-dashed', size === 'sm' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-xs')}>{range[0]}–{range[1]}</span>;
  const c = attrColor(v);
  return <span className={cx('inline-flex items-center justify-center rounded-md tnum font-bold', size === 'sm' ? 'h-5 min-w-7 px-1 text-[11px]' : 'h-6 min-w-8 px-1.5 text-xs')} style={{ background: c + '22', color: c, boxShadow: `inset 0 0 0 1px ${c}40` }}>{Math.round(v)}</span>;
}
export function AttrValue({ g, p, v }: { g: GameState; p: Player; v: number }) {
  const [lo, hi] = fuzzy(g, p, v);
  return <RatingChip v={v} range={[lo, hi]} size="sm" />;
}
export function Bar({ value, max = 100, color, h = 6 }: { value: number; max?: number; color?: string; h?: number }) {
  return <div className="w-full bg-ink-700 rounded-full overflow-hidden" style={{ height: h }}><div className="rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, height: h, background: color ?? attrColor(value) }} /></div>;
}

export function Stars({ n, dim }: { n: number | null; dim?: boolean }) {
  if (n == null) return <span className="text-ink-500 text-xs">? ? ?</span>;
  return (
    <span className={cx('inline-flex text-[13px] leading-none tracking-tight', dim ? 'text-amber-300/80' : 'text-accent')} title={`${n} / 5`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} className={n >= i - 0.5 ? '' : 'text-ink-600'}>{n >= i ? '★' : n >= i - 0.5 ? '⯪' : '★'}</span>)}
    </span>
  );
}
export function AbilityCell({ g, p }: { g: GameState; p: Player }) {
  const k = knowledge(g, p);
  const c = ca(p);
  if (k >= 95) return <RatingChip v={c} />;
  return <RatingChip v={c} range={fuzzy(g, p, c)} />;
}
export function PotCell({ g, p }: { g: GameState; p: Player }) { return <Stars n={potentialStars(g, p)} dim />; }
export function CaStars({ v }: { v: number }) { return <Stars n={abilityStars(v)} />; }

// ---------------------------------------------------------------- identity
export function Flag({ code, size = 14 }: { code: string; size?: number }) {
  const [err, setErr] = useState(false);
  const name = NATION_BY_CODE[code]?.name ?? code;
  if (err) return <span title={name} className="inline-flex items-center justify-center rounded-[3px] bg-ink-700 text-[9px] font-bold text-ink-200" style={{ width: size * 1.4, height: size }}>{code}</span>;
  return <img title={name} alt={code} src={`https://flagcdn.com/h20/${code.toLowerCase()}.png`} onError={() => setErr(true)} className="rounded-[3px] object-cover shrink-0 shadow-[0_0_0_1px_#0006]" style={{ width: size * 1.4, height: size }} />;
}
export const flagEl = (code: string) => <Flag code={code} />;

export function OrgBadge({ org, size = 20 }: { org: Pick<Org, 'tag' | 'colors'>; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center font-black shrink-0 tracking-tighter" style={{ width: size, height: size, borderRadius: size * 0.28, background: `linear-gradient(145deg, ${org.colors[1]}, ${org.colors[1]}cc)`, color: org.colors[0], boxShadow: `inset 0 0 0 1.5px ${org.colors[0]}66`, fontSize: Math.max(8, size * (org.tag.length > 3 ? 0.3 : 0.36)) }}>
      {org.tag.slice(0, 4)}
    </span>
  );
}
export function Avatar({ p, org, size = 36 }: { p: Player; org?: Org | null; size?: number }) {
  const c = org?.colors[0] ?? '#6c7689';
  return <span className="inline-flex items-center justify-center rounded-full font-bold shrink-0 uppercase" style={{ width: size, height: size, fontSize: size * 0.36, background: `${c}26`, color: c, boxShadow: `inset 0 0 0 1.5px ${c}55` }}>{p.tag.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '?'}</span>;
}
export function OrgLink({ org, badge = true, short }: { org: Org | undefined; badge?: boolean; short?: boolean }) {
  const nav = useStore(s => s.nav);
  if (!org) return <span className="text-ink-400">—</span>;
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {badge && <OrgBadge org={org} />}
      <span className={cx('link truncate', org.isUser ? 'text-accent font-semibold' : 'font-medium')} onClick={e => { e.stopPropagation(); nav('org', org.id); }}>{short ? org.tag : org.name}</span>
    </span>
  );
}
export function PlayerLink({ p, full }: { p: Player | undefined; full?: boolean }) {
  const nav = useStore(s => s.nav);
  if (!p) return <span className="text-ink-400">—</span>;
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <Flag code={p.nationality} size={12} />
      <span className="link font-semibold truncate" onClick={e => { e.stopPropagation(); nav('player', p.id); }}>{p.tag}</span>
      {full && (p.firstName || p.lastName) && <span className="text-ink-400 truncate">{p.firstName} {p.lastName}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- controls
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly T[] | T[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="inline-flex p-1 gap-1 bg-ink-900 border border-ink-700 rounded-xl flex-wrap">
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} className={cx('px-3.5 h-8 text-[13px] font-medium rounded-lg cursor-pointer transition-colors', value === t ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-300 hover:text-white hover:bg-ink-800')}>{t}</button>
      ))}
    </div>
  );
}
export function Seg<T extends string | number>({ options, value, onChange }: { options: { v: T; l: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex p-0.5 gap-0.5 bg-ink-850 border border-ink-600 rounded-lg flex-wrap">
      {options.map(o => <button key={String(o.v)} onClick={() => onChange(o.v)} className={cx('px-2.5 h-7 text-xs font-semibold rounded-md cursor-pointer', value === o.v ? 'bg-accent text-[#1a0d00]' : 'text-ink-300 hover:text-white')}>{o.l}</button>)}
    </div>
  );
}

export function Modal({ title, children, onClose, width = 560 }: { title: ReactNode; children: ReactNode; onClose: () => void; width?: number }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="card shadow-2xl slidein max-h-[90vh] flex flex-col w-full" style={{ maxWidth: width }} onMouseDown={e => e.stopPropagation()}>
        <header className="h-14 px-5 flex items-center justify-between border-b border-ink-700 shrink-0">
          <h2 className="font-bold text-base">{title}</h2>
          <button className="w-8 h-8 rounded-lg text-ink-300 hover:text-white hover:bg-ink-700 cursor-pointer" onClick={onClose}>✕</button>
        </header>
        <div className="p-5 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export function useSort<T>(rows: T[], init: { key: string; dir: 1 | -1 }, getters: Record<string, (r: T) => number | string>) {
  const [s, setS] = useState(init);
  const get = getters[s.key];
  const sorted = get ? [...rows].sort((a, b) => { const x = get(a), y = get(b); return (x < y ? -1 : x > y ? 1 : 0) * s.dir; }) : rows;
  const th = (key: string, label: ReactNode, cls?: string) => (
    <th className={cx('sortable', cls, s.key === key && 'text-ink-100!')} onClick={() => setS(c => ({ key, dir: c.key === key ? (c.dir === 1 ? -1 : 1) : -1 }))}>
      {label}<span className="ml-1 text-accent">{s.key === key ? (s.dir === 1 ? '↑' : '↓') : ''}</span>
    </th>
  );
  return { sorted, th };
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn' | 'accent' | 'info' }) {
  return <span className={cx('inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10.5px] font-semibold tracking-wide whitespace-nowrap',
    tone === 'default' && 'bg-ink-700 text-ink-200', tone === 'good' && 'bg-good/15 text-good', tone === 'bad' && 'bg-bad/15 text-bad',
    tone === 'warn' && 'bg-warn/15 text-warn', tone === 'accent' && 'bg-accent/15 text-accent', tone === 'info' && 'bg-info/15 text-info')}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) { return <div className="text-ink-400 text-sm py-8 px-4 text-center">{children}</div>; }

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 min-w-0"><span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</span>{children}</label>;
}

export function moraleLabel(v: number) { return v >= 80 ? 'Excellent' : v >= 65 ? 'Bon' : v >= 45 ? 'Correct' : v >= 30 ? 'Faible' : 'Très faible'; }
export function moraleTone(v: number): 'good' | 'warn' | 'bad' | 'default' { return v >= 65 ? 'good' : v >= 45 ? 'default' : v >= 30 ? 'warn' : 'bad'; }
export function CondDot({ p }: { p: Player }) {
  const c = p.cond;
  const injured = !!c.injuredUntil;
  const col = injured ? '#f87171' : c.fatigue > 70 ? '#fb923c' : c.fatigue > 45 ? '#facc15' : '#34d399';
  return <span title={injured ? `Indisponible jusqu'au ${c.injuredUntil}` : `Fatigue ${Math.round(c.fatigue)}%`} className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: col, boxShadow: `0 0 0 3px ${col}22` }} />;
}
