import { useState } from 'react'
import { useApp, useAsync } from '../store'
import { api } from '../api/client'
import type { NetworkSummary } from '../types'
import { DataTable, type Column } from '../components/DataTable'
import { Drawer } from '../components/Drawer'
import { JsonView } from '../components/JsonView'
import { Badge, ErrorBanner, FullSpinner, PageHeader, Spinner, fmtDate, shortId } from '../components/ui'

function NetworkInspect({ id }: { id: string }) {
  const insp = useAsync(() => api.inspect('network', id), [id])
  if (insp.loading && !insp.data) return <Spinner />
  if (insp.error) return <div className="text-err text-xs">{insp.error}</div>
  return <JsonView raw={insp.data ?? ''} />
}

export function Networks() {
  const { activeId, tick } = useApp()
  const { data, error, loading, reload } = useAsync(() => api.listNetworks(), [activeId, tick])
  const [selected, setSelected] = useState<NetworkSummary | null>(null)

  if (loading && !data) return <FullSpinner label="Listing networks…" />
  if (error) return <ErrorBanner error={error} onRetry={reload} />

  const columns: Column<NetworkSummary>[] = [
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
    { header: 'Driver', value: (r) => r.Driver, render: (r) => <Badge tone={r.Driver === 'overlay' ? 'accent' : 'dim'}>{r.Driver}</Badge> },
    { header: 'Scope', value: (r) => r.Scope, render: (r) => <Badge tone={r.Scope === 'swarm' ? 'accent' : 'dim'}>{r.Scope}</Badge> },
    { header: 'Internal', value: (r) => r.Internal, render: (r) => <span className="text-mute">{r.Internal || 'false'}</span> },
    { header: 'Created', value: (r) => r.CreatedAt, render: (r) => <span className="text-mute text-[11px]">{fmtDate(r.CreatedAt)}</span> },
  ]

  return (
    <>
      <PageHeader title="Networks" count={data?.length} sub="Overlay and local networks visible on this host" />
      <DataTable
        columns={columns}
        rows={data ?? []}
        keyFn={(r) => r.ID}
        searchPlaceholder="Search networks…"
        onRowClick={setSelected}
        emptyTitle="No networks"
      />
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.Name ?? ''} sub={selected?.ID}>
        {selected && <NetworkInspect id={selected.ID} />}
      </Drawer>
    </>
  )
}
