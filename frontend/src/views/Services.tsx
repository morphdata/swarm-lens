import { useState } from 'react'
import { RotateCw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useApp, useAsync } from '../store'
import { api } from '../api/client'
import type { ServiceSummary } from '../types'
import { DataTable, type Column } from '../components/DataTable'
import { ConfirmModal, Modal } from '../components/Modal'
import { Badge, Btn, ErrorBanner, FullSpinner, IconBtn, PageHeader } from '../components/ui'

export function ReplicaBadge({ replicas }: { replicas: string }) {
  const m = (replicas || '').match(/(\d+)\s*\/\s*(\d+)/)
  if (!m) return <Badge tone="dim">{replicas || '—'}</Badge>
  return <Badge tone={m[1] === m[2] ? 'ok' : 'warn'}>{replicas}</Badge>
}

/** Scale / restart / remove controls with their modals. Used in the list and detail views. */
export function ServiceActionButtons({
  svc, onChanged, onRemoved, compact = true,
}: {
  svc: ServiceSummary
  onChanged: () => void
  onRemoved?: () => void
  compact?: boolean
}) {
  const [scaleOpen, setScaleOpen] = useState(false)
  const [replicas, setReplicas] = useState(1)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const current = parseInt((svc.Replicas.match(/\/(\d+)/) ?? [])[1] ?? '1', 10)
  const isGlobal = svc.Mode.toLowerCase() === 'global'

  const run = async (fn: () => Promise<unknown>, close: () => void) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      close()
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <IconBtn
        title={isGlobal ? 'Global services cannot be scaled' : 'Scale service'}
        disabled={isGlobal}
        onClick={() => {
          setReplicas(current)
          setErr(null)
          setScaleOpen(true)
        }}
      >
        <SlidersHorizontal size={13} />
      </IconBtn>
      <IconBtn title="Restart (force new rollout)" onClick={() => { setErr(null); setConfirmRestart(true) }}>
        <RotateCw size={13} />
      </IconBtn>
      <IconBtn title="Remove service" danger onClick={() => { setErr(null); setConfirmRemove(true) }}>
        <Trash2 size={13} />
      </IconBtn>

      <Modal
        open={scaleOpen}
        onClose={() => setScaleOpen(false)}
        title={`Scale ${svc.Name}`}
        footer={
          <>
            <Btn onClick={() => setScaleOpen(false)}>Cancel</Btn>
            <Btn variant="primary" disabled={busy || replicas < 0} onClick={() => run(() => api.scaleService(svc.ID, replicas), () => setScaleOpen(false))}>
              Scale to {replicas}
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-xs text-mute">
            Currently <span className="text-txt font-mono">{svc.Replicas}</span>. Tasks are spread across available nodes.
          </div>
          <input
            type="number"
            min={0}
            value={replicas}
            onChange={(e) => setReplicas(Math.max(0, Number(e.target.value)))}
            className="w-28 bg-panel2 border border-edge rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent/50"
            autoFocus
          />
          {err && <div className="text-err text-xs font-mono select-text">{err}</div>}
        </div>
      </Modal>

      <ConfirmModal
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onConfirm={() => run(() => api.restartService(svc.ID), () => setConfirmRestart(false))}
        title={`Restart ${svc.Name}?`}
        body={
          <>
            Forces a rolling restart: every task of <b className="text-txt">{svc.Name}</b> is replaced
            one by one (<span className="font-mono">docker service update --force</span>).
          </>
        }
        confirmLabel="Restart"
        busy={busy}
        error={err}
      />

      <ConfirmModal
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() =>
          run(async () => {
            await api.removeService(svc.ID)
            onRemoved?.()
          }, () => setConfirmRemove(false))
        }
        title={`Remove service ${svc.Name}?`}
        body={
          <>
            Permanently removes <b className="text-txt">{svc.Name}</b> and all its tasks
            (<span className="font-mono">docker service rm</span>). Volumes are kept.
          </>
        }
        busy={busy}
        error={err}
      />
    </>
  )
}

export function Services() {
  const { activeId, tick, navigate, refresh } = useApp()
  const { data, error, loading, reload } = useAsync(() => api.listServices(), [activeId, tick])

  if (loading && !data) return <FullSpinner label="Listing services…" />
  if (error) return <ErrorBanner error={error} onRetry={reload} />

  const columns: Column<ServiceSummary>[] = [
    {
      header: 'Name',
      value: (r) => r.Name,
      render: (r) => (
        <div>
          <div className="font-medium text-txt">{r.Name}</div>
          <div className="text-[10px] text-dim font-mono">{r.ID}</div>
        </div>
      ),
    },
    { header: 'Mode', value: (r) => r.Mode, render: (r) => <Badge tone={r.Mode === 'global' ? 'accent' : 'dim'}>{r.Mode}</Badge> },
    { header: 'Replicas', value: (r) => r.Replicas, render: (r) => <ReplicaBadge replicas={r.Replicas} /> },
    {
      header: 'Image',
      value: (r) => r.Image,
      className: 'max-w-[280px]',
      render: (r) => <span className="font-mono text-[11px] text-txt/80 block truncate">{r.Image}</span>,
    },
    {
      header: 'Ports',
      value: (r) => r.Ports,
      className: 'max-w-[220px]',
      render: (r) => <span className="font-mono text-[11px] text-mute block truncate">{r.Ports || '—'}</span>,
    },
  ]

  return (
    <>
      <PageHeader title="Services" count={data?.length} sub="Swarm services on the active manager" />
      <DataTable
        columns={columns}
        rows={data ?? []}
        keyFn={(r) => r.ID}
        searchPlaceholder="Search services…"
        onRowClick={(r) => navigate('services', r.Name)}
        emptyTitle="No services"
        emptySub="Deploy one with docker stack deploy, or check that this node is a manager."
        rowAccessory={(r) => <ServiceActionButtons svc={r} onChanged={() => { reload(); refresh() }} />}
      />
    </>
  )
}
