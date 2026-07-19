import { useState } from 'react'
import { FileJson, ScrollText, Trash2 } from 'lucide-react'
import { useApp, useAsync } from '../store'
import { api } from '../api/client'
import type { ContainerSummary } from '../types'
import { DataTable, type Column } from '../components/DataTable'
import { Drawer } from '../components/Drawer'
import { ConfirmModal } from '../components/Modal'
import { JsonView } from '../components/JsonView'
import { LogViewer } from '../components/LogViewer'
import { Btn, ErrorBanner, FullSpinner, IconBtn, PageHeader, Spinner, StatusBadge, shortId } from '../components/ui'

function ContainerInspect({ id }: { id: string }) {
  const insp = useAsync(() => api.inspect('container', id), [id])
  if (insp.loading && !insp.data) return <Spinner />
  if (insp.error) return <div className="text-err text-xs">{insp.error}</div>
  return <JsonView raw={insp.data ?? ''} />
}

export function Containers() {
  const { activeId, tick, refresh } = useApp()
  const [all, setAll] = useState(false)
  const { data, error, loading, reload } = useAsync(() => api.listContainers(all), [activeId, tick, all])
  const [logsFor, setLogsFor] = useState<ContainerSummary | null>(null)
  const [inspectFor, setInspectFor] = useState<ContainerSummary | null>(null)
  const [removing, setRemoving] = useState<ContainerSummary | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading && !data) return <FullSpinner label="Listing containers…" />
  if (error) return <ErrorBanner error={error} onRetry={reload} />

  const columns: Column<ContainerSummary>[] = [
    {
      header: 'Name',
      value: (r) => r.Names,
      render: (r) => (
        <div>
          <div className="font-medium text-txt">{r.Names}</div>
          <div className="text-[10px] text-dim font-mono">{shortId(r.ID)}</div>
        </div>
      ),
    },
    {
      header: 'Image',
      value: (r) => r.Image,
      className: 'max-w-[240px]',
      render: (r) => <span className="font-mono text-[11px] text-txt/80 block truncate">{r.Image}</span>,
    },
    { header: 'State', value: (r) => r.State, render: (r) => <StatusBadge status={r.State} /> },
    { header: 'Status', value: (r) => r.Status, render: (r) => <span className="text-mute text-[11px]">{r.Status}</span> },
    {
      header: 'Ports',
      value: (r) => r.Ports,
      className: 'max-w-[200px]',
      render: (r) => <span className="font-mono text-[11px] text-mute block truncate">{r.Ports || '—'}</span>,
    },
    { header: 'Created', value: (r) => r.RunningFor, render: (r) => <span className="text-mute text-[11px]">{r.RunningFor}</span> },
  ]

  return (
    <>
      <PageHeader
        title="Containers"
        count={data?.length}
        sub="Containers on the connected host — swarm tasks on other nodes live on their own hosts"
        actions={
          <Btn variant={all ? 'primary' : 'default'} onClick={() => setAll((a) => !a)}>
            {all ? 'Showing all' : 'Running only'}
          </Btn>
        }
      />
      <DataTable
        columns={columns}
        rows={data ?? []}
        keyFn={(r) => r.ID}
        searchPlaceholder="Search containers…"
        emptyTitle="No containers"
        emptySub={all ? 'No containers exist on this host.' : 'No running containers on this host.'}
        rowAccessory={(r) => (
          <>
            <IconBtn title="Logs" onClick={() => setLogsFor(r)}>
              <ScrollText size={13} />
            </IconBtn>
            <IconBtn title="Inspect" onClick={() => setInspectFor(r)}>
              <FileJson size={13} />
            </IconBtn>
            <IconBtn title="Remove" danger onClick={() => setRemoving(r)}>
              <Trash2 size={13} />
            </IconBtn>
          </>
        )}
      />

      <Drawer open={!!logsFor} onClose={() => setLogsFor(null)} title={`Logs · ${logsFor?.Names ?? ''}`} sub={logsFor?.ID}>
        {logsFor && (
          <div className="h-[calc(100vh-140px)]">
            <LogViewer kind="container" id={logsFor.ID} />
          </div>
        )}
      </Drawer>

      <Drawer open={!!inspectFor} onClose={() => setInspectFor(null)} title={`Inspect · ${inspectFor?.Names ?? ''}`} sub={inspectFor?.ID}>
        {inspectFor && <ContainerInspect id={inspectFor.ID} />}
      </Drawer>

      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        busy={busy}
        title={`Remove container ${removing?.Names}?`}
        body={
          <>
            Force-removes <b className="text-txt">{removing?.Names}</b>. If it is a swarm task, the
            scheduler will start a replacement automatically.
          </>
        }
        onConfirm={async () => {
          if (!removing) return
          setBusy(true)
          try {
            await api.removeContainer(removing.ID, true)
            setRemoving(null)
            reload()
            refresh()
          } finally {
            setBusy(false)
          }
        }}
      />
    </>
  )
}
