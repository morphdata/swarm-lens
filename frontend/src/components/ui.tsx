import React from 'react'
import clsx from 'clsx'
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react'

// ---- helpers ----

export function shortId(id: string, n = 12): string {
  if (!id) return '—'
  return id.length > n ? id.slice(0, n) : id
}

export function fmtBytes(n: number): string {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const i = Math.min(units.length - 1, Math.floor(Math.log2(n) / 10))
  return `${(n / 2 ** (10 * i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function fmtDate(s: string): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ---- primitives ----

export function Spinner({ className }: { className?: string }) {
  return <Loader2 size={16} className={clsx('animate-spin text-mute', className)} />
}

export function FullSpinner({ label }: { label?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-mute">
      <Spinner className="text-accent" />
      <span className="text-xs">{label ?? 'Loading…'}</span>
    </div>
  )
}

type Tone = 'ok' | 'warn' | 'err' | 'dim' | 'accent'

const toneClasses: Record<Tone, string> = {
  ok: 'bg-ok/10 text-ok border-ok/20',
  warn: 'bg-warn/10 text-warn border-warn/20',
  err: 'bg-err/10 text-err border-err/20',
  dim: 'bg-white/5 text-mute border-edge',
  accent: 'bg-accent/10 text-accent border-accent/20',
}

export function Badge({ tone = 'dim', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] leading-4 whitespace-nowrap', toneClasses[tone], className)}>
      {children}
    </span>
  )
}

export function statusTone(status: string): Tone {
  const s = (status || '').toLowerCase()
  if (!s) return 'dim'
  if (['ready', 'running', 'active', 'leader', 'reachable', 'completed', 'up'].some((k) => s.startsWith(k))) return 'ok'
  if (['failed', 'rejected', 'down', 'orphaned', 'error', 'dead', 'exited'].some((k) => s.startsWith(k))) return 'err'
  if (['drain', 'shutdown', 'complete'].some((k) => s.startsWith(k))) return 'dim'
  return 'warn'
}

export function StatusBadge({ status, empty = '—' }: { status: string; empty?: string }) {
  if (!status) return <span className="text-dim">{empty}</span>
  return (
    <Badge tone={statusTone(status)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx('bg-panel border border-edge rounded-lg', className)}>{children}</div>
}

export function Btn({
  variant = 'default', className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost' }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'default' && 'bg-panel2 border border-edge2 text-txt hover:bg-edge2/60',
        variant === 'primary' && 'bg-accent text-ink hover:bg-accent/85',
        variant === 'danger' && 'bg-err/15 text-err border border-err/30 hover:bg-err/25',
        variant === 'ghost' && 'text-mute hover:text-txt hover:bg-panel2',
        className,
      )}
      {...props}
    />
  )
}

export function IconBtn({
  title, danger, className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string; danger?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      className={clsx(
        'p-1.5 rounded-md transition-colors text-mute',
        danger ? 'hover:text-err hover:bg-err/10' : 'hover:text-txt hover:bg-panel2',
        className,
      )}
      {...props}
    />
  )
}

export function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="m-4 p-3 rounded-lg bg-err/10 border border-err/25 text-err flex items-start gap-2.5">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-xs mb-0.5">Request failed</div>
        <div className="text-xs text-err/80 break-words font-mono select-text">{error}</div>
      </div>
      {onRetry && (
        <Btn variant="danger" onClick={onRetry} className="shrink-0">
          <RefreshCw size={12} /> Retry
        </Btn>
      )}
    </div>
  )
}

export function Empty({ icon, title, sub, action }: { icon?: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
      {icon && <div className="text-dim mb-1">{icon}</div>}
      <div className="text-sm text-mute">{title}</div>
      {sub && <div className="text-xs text-dim max-w-sm">{sub}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, count, sub, actions }: { title: string; count?: number; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="shrink-0 px-4 pt-3.5 pb-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
          {count !== undefined && <Badge tone="dim">{count}</Badge>}
        </div>
        {sub && <div className="text-xs text-mute mt-0.5 truncate">{sub}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function KV({ k, v, mono = true }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-edge/60 last:border-0">
      <div className="w-36 shrink-0 text-xs text-mute pt-px">{k}</div>
      <div className={clsx('flex-1 min-w-0 text-xs break-words select-text', mono && 'font-mono')}>{v ?? '—'}</div>
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-dim font-semibold mb-2 mt-1">{children}</div>
}
