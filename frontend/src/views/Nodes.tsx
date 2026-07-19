import { useState } from 'react'
import { useApp, useAsync } from '../store'
import { api } from '../api/client'
import type { NodeSummary } from '../types'
import { DataTable, type Column } from '../components/DataTable'
import { Drawer } from '../components/Drawer'
import { ConfirmModal } from '../components/Modal'
import { JsonView } from '../components/JsonView'
import { Badge, Btn, ErrorBanner, FullSpinner, KV, SectionTitle, Spinner, StatusBadge, shortId } from '../components/ui'

function NodeDetail({ node, onClose }: { node: NodeSummary; onClose: () => void }) {
  const { refresh } = useApp()
  const insp = useAsync(() => api.inspect('node', node.ID), [node.ID])
  const [confirmRm, setConfirmRm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const isManager = !!node.ManagerStatus

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      refresh()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Node</SectionTitle>
        <KV k="Hostname" v={node.Hostname} />
        <KV k="ID" v={node.ID} />
        <KV k="Status" v={<StatusBadge status={node.Status} />} mono={false} />
        <KV k="Availability" v={<StatusBadge status={node.Availability} />} mono={false} />
        <KV k="Role" v={isManager ? `manager (${node.ManagerStatus})` : 'worker'} />
        <KV k="Engine" v={node.EngineVersion} />
        <KV k="TLS" v={node.TLSStatus} />
      </div>

      <div>
        <SectionTitle>Actions</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {(['active', 'pause', 'drain'] as const).map((a) => (
            <Btn key={a} disabled={busy || node.Availability.toLowerCase() === a} onClick={() => run(() => api.setNodeAvailability(node.ID, a))}>
              Set {a}
            </Btn>
          ))}
          {!isManager && (
            <Btn variant="danger" disabled={busy} onClick={() => setConfirmRm(true)}>
              Remove node
            </Btn>
          )}
        </div>
        {isManager && (
          <div className="text-[10px] text-dim mt-1.5">Demote the manager from another manager before removing it.</div>
        )}
        {err && <div className="text-err text-xs mt-2 font-mono select-text">{err}</div>}
      </div>

      <div>
        <SectionTitle>Inspect</SectionTitle>
        {insp.loading && <Spinner />}
        {insp.error && <div className="text-err text-xs">{insp.error}</div>}
        {insp.data && <JsonView raw={insp.data} />}
      </div>

      <ConfirmModal
        open={confirmRm}
        onClose={() => setConfirmRm(false)}
        onConfirm={() => run(() => api.removeNode(node.ID, false))}
        title={`Remove node ${node.Hostname}?`}
        body={
          <>
            Removes <b className="text-txt">{node.Hostname}</b> from the swarm. Drain it first to
            migrate its tasks to other nodes. This does not uninstall Docker on the machine.
          </>
        }
        busy={busy}
      />
    </div>
  )
}

export function Nodes() {
  const { activeId, tick } = useApp()
  const { data, error, loading, reload } = useAsync(() => api.listNodes(), [activeId, tick])
  const [selected, setSelected] = useState<NodeSummary | null>(null)

  if (loading && !data) return <FullSpinner label="Listing nodes…" />
  if (error) return <ErrorBanner error={error} onRetry={reload} />

  const columns: Column<NodeSummary>[] = [
    {
      header: 'Hostname',
      value: (r) => r.Hostname,
      render: (r) => (
        <div>
          <div className="font-medium text-txt">{r.Hostname}</div>
          <div className="text-[10px] text-dim font-mono">{shortId(r.ID)}</div>
        </div>
      ),
    },
    { header: 'Status', value: (r) => r.Status, render: (r) => <StatusBadge status={r.Status} /> },
    { header: 'Availability', value: (r) => r.Availability, render: (r) => <StatusBadge status={r.Availability} /> },
    {
      header: 'Manager status',
      value: (r) => r.ManagerStatus,
      render: (r) =>
        r.ManagerStatus ? (
          <Badge tone={r.ManagerStatus === 'Leader' ? 'accent' : 'dim'}>{r.ManagerStatus}</Badge>
        ) : (
          <span className="text-dim">worker</span>
        ),
    },
    { header: 'Engine', value: (r) => r.EngineVersion, render: (r) => <span className="font-mono text-[11px]">{r.EngineVersion}</span> },
    { header: 'TLS', value: (r) => r.TLSStatus, render: (r) => <StatusBadge status={r.TLSStatus} /> },
  ]

  return (
    <>
      <div className="shrink-0 px-4 pt-3.5 pb-3 flex items-center gap-2">
        <h1 className="text-[15px] font-semibold tracking-tight">Nodes</h1>
        <Badge tone="dim">{data?.length ?? 0}</Badge>
      </div>
      <DataTable
        columns={columns}
        rows={data ?? []}
        keyFn={(r) => r.ID}
        searchPlaceholder="Search nodes…"
        onRowClick={setSelected}
        emptyTitle="No nodes"
        emptySub="Is the connected server a swarm manager?"
      />
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.Hostname ?? ''}
        sub={selected?.ID}
      >
        {selected && <NodeDetail node={selected} onClose={() => setSelected(null)} />}
      </Drawer>
    </>
  )
}
