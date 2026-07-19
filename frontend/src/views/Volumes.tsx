import { useState } from 'react'
import { useApp, useAsync } from '../store'
import { api } from '../api/client'
import type { VolumeSummary } from '../types'
import { DataTable, type Column } from '../components/DataTable'
import { Drawer } from '../components/Drawer'
import { JsonView } from '../components/JsonView'
import { ErrorBanner, FullSpinner, PageHeader, Spinner } from '../components/ui'

function VolumeInspect({ name }: { name: string }) {
  const insp = useAsync(() => api.inspect('volume', name), [name])
  if (insp.loading && !insp.data) return <Spinner />
  if (insp.error) return <div className="text-err text-xs">{insp.error}</div>
  return <JsonView raw={insp.data ?? ''} />
}

export function Volumes() {
  const { activeId, tick } = useApp()
  const { data, error, loading, reload } = useAsync(() => api.listVolumes(), [activeId, tick])
  const [selected, setSelected] = useState<VolumeSummary | null>(null)

  if (loading && !data) return <FullSpinner label="Listing volumes…" />
  if (error) return <ErrorBanner error={error} onRetry={reload} />

  const columns: Column<VolumeSummary>[] = [
    { header: 'Name', value: (r) => r.Name, render: (r) => <span className="font-medium text-txt">{r.Name}</span> },
    { header: 'Driver', value: (r) => r.Driver, render: (r) => <span className="text-mute">{r.Driver}</span> },
    {
      header: 'Mountpoint',
      value: (r) => r.Mountpoint,
      className: 'max-w-[320px]',
      render: (r) => <span className="font-mono text-[11px] text-mute block truncate">{r.Mountpoint || '—'}</span>,
    },
    {
      header: 'Labels',
      value: (r) => r.Labels,
      className: 'max-w-[220px]',
      render: (r) => <span className="font-mono text-[11px] text-dim block truncate">{r.Labels || '—'}</span>,
    },
  ]

  return (
    <>
      <PageHeader title="Volumes" count={data?.length} sub="Volumes on the connected host" />
      <DataTable
        columns={columns}
        rows={data ?? []}
        keyFn={(r) => r.Name}
        searchPlaceholder="Search volumes…"
        onRowClick={setSelected}
        emptyTitle="No volumes"
      />
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.Name ?? ''}>
        {selected && <VolumeInspect name={selected.Name} />}
      </Drawer>
    </>
  )
}
