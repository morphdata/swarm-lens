import React, { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Search, ChevronUp, ChevronDown, Inbox } from 'lucide-react'
import { Empty } from './ui'

export interface Column<T> {
  header: React.ReactNode
  className?: string
  value: (row: T) => string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  keyFn: (row: T) => string
  searchPlaceholder?: string
  onRowClick?: (row: T) => void
  selectedKey?: string
  emptyTitle?: string
  emptySub?: string
  rowAccessory?: (row: T) => React.ReactNode
}

export function DataTable<T>({
  columns, rows, keyFn, searchPlaceholder = 'Search…', onRowClick,
  selectedKey, emptyTitle = 'Nothing here', emptySub, rowAccessory,
}: Props<T>) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = rows
    if (q) {
      out = out.filter((r) => columns.some((c) => c.value(r).toLowerCase().includes(q)))
    }
    if (sort !== null) {
      const col = columns[sort.col]
      out = [...out].sort((a, b) => col.value(a).localeCompare(col.value(b)) * sort.dir)
    }
    return out
  }, [rows, query, sort, columns])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-4 pb-2.5">
        <div className="relative w-72 max-w-full">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-panel2 border border-edge rounded-md pl-8 pr-3 py-1.5 text-xs placeholder:text-dim focus:outline-none focus:border-accent/50"
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto border-t border-edge">
        {filtered.length === 0 ? (
          <Empty
            icon={<Inbox size={28} strokeWidth={1.5} />}
            title={rows.length === 0 ? emptyTitle : 'No matches'}
            sub={rows.length === 0 ? emptySub : `Nothing matches "${query}"`}
          />
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-panel">
                {columns.map((c, i) => (
                  <th
                    key={i}
                    onClick={() => {
                      if (c.sortable === false) return
                      setSort((s) =>
                        s?.col === i ? (s.dir === 1 ? { col: i, dir: -1 } : null) : { col: i, dir: 1 },
                      )
                    }}
                    className={clsx(
                      'text-left font-medium text-mute px-4 py-2 border-b border-edge whitespace-nowrap select-none',
                      c.sortable !== false && 'cursor-pointer hover:text-txt',
                      c.className,
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.header}
                      {sort?.col === i && (sort.dir === 1 ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </span>
                  </th>
                ))}
                {rowAccessory && <th className="w-24 border-b border-edge" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const key = keyFn(r)
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    className={clsx(
                      'border-b border-edge/60 transition-colors',
                      onRowClick && 'cursor-pointer',
                      selectedKey === key ? 'bg-accent/5' : 'hover:bg-panel2/70',
                    )}
                  >
                    {columns.map((c, i) => (
                      <td key={i} className={clsx('px-4 py-2 align-middle', c.className)}>
                        {c.render ? c.render(r) : <span className="text-txt/90">{c.value(r) || '—'}</span>}
                      </td>
                    ))}
                    {rowAccessory && (
                      <td className="px-2 py-1 align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">{rowAccessory(r)}</div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
