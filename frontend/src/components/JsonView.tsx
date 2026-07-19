import React, { useMemo } from 'react'
import clsx from 'clsx'

function Primitive({ v }: { v: unknown }) {
  if (v === null) return <span className="text-dim">null</span>
  switch (typeof v) {
    case 'string':
      return <span className="text-ok">"{v}"</span>
    case 'number':
      return <span className="text-accent">{String(v)}</span>
    case 'boolean':
      return <span className="text-warn">{String(v)}</span>
    default:
      return <span className="text-txt">{String(v)}</span>
  }
}

function Node({ k, v, depth }: { k?: string; v: unknown; depth: number }) {
  const key = k !== undefined && <span className="text-accent/90">{k}</span>

  if (v !== null && typeof v === 'object') {
    const isArr = Array.isArray(v)
    const entries = isArr
      ? (v as unknown[]).map((item, i) => [String(i), item] as const)
      : Object.entries(v as Record<string, unknown>)
    const empty = entries.length === 0
    return (
      <div className={clsx(depth > 0 && 'ml-3 pl-2 border-l border-edge/50')}>
        <details open={depth < 2}>
          <summary className="cursor-pointer list-none flex items-center gap-1.5 py-px hover:bg-panel2/60 rounded px-0.5 -ml-0.5 select-none">
            <span className="text-dim text-[9px] w-2">▸</span>
            {key}
            <span className="text-dim">
              {isArr ? `[${entries.length}]` : `{${entries.length}}`}
            </span>
          </summary>
          {!empty && (
            <div className="ml-3 pl-2 border-l border-edge/50">
              {entries.map(([ek, ev]) => (
                <Node key={ek} k={isArr ? undefined : ek} v={ev} depth={depth + 1} />
              ))}
            </div>
          )}
        </details>
      </div>
    )
  }

  return (
    <div className={clsx('flex gap-1.5 py-px', depth > 0 && 'ml-3 pl-2')}>
      {key}
      {k !== undefined && <span className="text-dim">:</span>}
      <Primitive v={v} />
    </div>
  )
}

/** Collapsible JSON tree with graceful fallback for unparseable payloads. */
export function JsonView({ raw }: { raw: string }) {
  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(raw) as unknown }
    } catch {
      return { ok: false as const, value: raw }
    }
  }, [raw])

  if (!parsed.ok) {
    return <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all select-text text-txt/80">{raw}</pre>
  }
  return (
    <div className="font-mono text-[11px] leading-[1.6] select-text">
      <Node v={parsed.value} depth={0} />
    </div>
  )
}
