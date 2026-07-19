import { useState } from 'react'
import clsx from 'clsx'
import { useApp, useAsync } from '../store'
import { api } from '../api/client'
import type { ConfigSummary, SecretSummary } from '../types'
import { DataTable, type Column } from '../components/DataTable'
import { Drawer } from '../components/Drawer'
import { JsonView } from '../components/JsonView'
import { ErrorBanner, FullSpinner, PageHeader, Spinner, fmtDate, shortId } from '../components/ui'

type Tab = 'secrets' | 'configs'

function Inspect({ kind, id }: { kind: string; id: string }) {
  const insp = useAsync(() => api.inspect(kind, id), [kind, id])
  if (insp.loading && !insp.data) return <Spinner />
  if (insp.error) return <div className="text-err text-xs">{insp.error}</div>
  return <JsonView raw={insp.data ?? ''} />
}

export function ConfigsView() {
  const { activeId, tick } = useApp()
  const [tab, setTab] = useState<Tab>('secrets')
  const secrets = useAsync(() => api.listSecrets(), [activeId, tick])
  const configs = useAsync(() => api.listConfigs(), [activeId, tick])
  const [selected, setSelected] = useState<(SecretSummary | ConfigSummary) | null>(null)

  const active = tab === 'secrets' ? secrets : configs
  if (active.loading && !active.data) return <FullSpinner label={`Listing ${tab}…`} />
  if (active.error) return <ErrorBanner error={active.error} onRetry={active.reload} />

  const columns: Column<SecretSummary | ConfigSummary>[] = [
    {
      header: 'Name',
      value: (r) => r.Name,
      render: (r) => (
        <div>
          <div className="font-medium text-txt">{r.Name}</div>
          <div className="text-[10px] text-dim font-mono">{shortId(r.ID)}</div>
        </div>
      ),
    },
    { header: 'Created', value: (r) => r.CreatedAt, render: (r) => <span className="text-mute text-[11px]">{fmtDate(r.CreatedAt)}</span> },
    { header: 'Updated', value: (r) => r.UpdatedAt, render: (r) => <span className="text-mute text-[11px]">{fmtDate(r.UpdatedAt)}</span> },
    {
      header: 'Labels',
      value: (r) => r.Labels,
      className: 'max-w-[240px]',
      render: (r) => <span className="font-mono text-[11px] text-dim block truncate">{r.Labels || '—'}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Secrets & Configs"
        sub="Swarm-scoped configuration objects (manager-only). Secret values are never readable."
      />
      <div className="shrink-0 px-4 flex items-center gap-1 pb-2">
        {(['secrets', 'configs'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-2.5 py-1 rounded-md text-xs capitalize transition-colors',
              tab === t ? 'bg-accent/10 text-accent' : 'text-mute hover:text-txt hover:bg-panel2',
            )}
          >
            {t}
            <span className="ml-1.5 text-dim">{t === 'secrets' ? secrets.data?.length ?? 0 : configs.data?.length ?? 0}</span>
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        rows={(active.data ?? []) as (SecretSummary | ConfigSummary)[]}
        keyFn={(r) => r.ID}
        searchPlaceholder={`Search ${tab}…`}
        onRowClick={setSelected}
        emptyTitle={`No ${tab}`}
      />
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.Name ?? ''} sub={selected?.ID}>
        {selected && <Inspect kind={tab === 'secrets' ? 'secret' : 'config'} id={selected.ID} />}
      </Drawer>
    </>
  )
}
