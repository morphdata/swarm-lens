import { useState } from 'react'
import { ChevronDown, ChevronRight, Layers, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useApp, useAsync } from '../store'
import { api } from '../api/client'
import type { StackSummary } from '../types'
import { ConfirmModal } from '../components/Modal'
import { Badge, Card, Empty, ErrorBanner, FullSpinner, IconBtn, PageHeader, StatusBadge } from '../components/ui'
import { ReplicaBadge } from './Services'

function StackDetail({ name }: { name: string }) {
  const { activeId, tick, navigate } = useApp()
  const svcs = useAsync(() => api.listStackServices(name), [activeId, tick, name])
  const tasks = useAsync(() => api.listStackTasks(name), [activeId, tick, name])

  if ((svcs.loading && !svcs.data) || (tasks.loading && !tasks.data)) {
    return <div className="px-4 py-3 text-xs text-mute">Loading stack…</div>
  }
  if (svcs.error) return <div className="px-4 py-3 text-xs text-err">{svcs.error}</div>

  return (
    <div className="px-3 pb-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-dim font-semibold pt-1">Services</div>
      <div className="rounded-md border border-edge overflow-hidden">
        {(svcs.data ?? []).map((s) => (
          <button
            key={s.ID}
            onClick={() => navigate('services', s.Name)}
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-panel2 border-b border-edge/60 last:border-0"
          >
            <span className="text-xs font-medium flex-1 truncate">{s.Name}</span>
            <Badge tone={s.Mode === 'global' ? 'accent' : 'dim'}>{s.Mode}</Badge>
            <ReplicaBadge replicas={s.Replicas} />
            <span className="font-mono text-[11px] text-mute truncate max-w-[220px]">{s.Image}</span>
          </button>
        ))}
      </div>
      {tasks.data && tasks.data.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-wider text-dim font-semibold pt-1">Tasks</div>
          <div className="rounded-md border border-edge overflow-hidden">
            {tasks.data.map((t) => (
              <div key={t.ID} className="flex items-center gap-3 px-3 py-1.5 border-b border-edge/60 last:border-0 text-xs">
                <span className="flex-1 truncate font-mono text-[11px]">{t.Name}</span>
                <span className="text-mute">{t.Node}</span>
                <StatusBadge status={t.CurrentState.split(' ')[0]} />
                {t.Error && <span className="text-err text-[11px] truncate max-w-[180px]">{t.Error}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function Stacks() {
  const { activeId, tick, refresh } = useApp()
  const { data, error, loading, reload } = useAsync(() => api.listStacks(), [activeId, tick])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [removing, setRemoving] = useState<StackSummary | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading && !data) return <FullSpinner label="Listing stacks…" />
  if (error) return <ErrorBanner error={error} onRetry={reload} />

  return (
    <>
      <PageHeader title="Stacks" count={data?.length} sub="Compose applications deployed with docker stack deploy" />
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2">
        {(data ?? []).length === 0 && (
          <Empty icon={<Layers size={28} strokeWidth={1.5} />} title="No stacks deployed" sub="Stacks group services deployed from a Compose file via docker stack deploy." />
        )}
        {(data ?? []).map((st) => {
          const open = expanded === st.Name
          return (
            <Card key={st.Name} className="overflow-hidden">
              <div
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-panel2/60"
                onClick={() => setExpanded(open ? null : st.Name)}
              >
                {open ? <ChevronDown size={14} className="text-mute" /> : <ChevronRight size={14} className="text-mute" />}
                <span className="text-sm font-medium flex-1">{st.Name}</span>
                <Badge tone="dim">{st.Services} service{st.Services === '1' ? '' : 's'}</Badge>
                <Badge tone="accent">{st.Orchestrator || 'Swarm'}</Badge>
                <span onClick={(e) => e.stopPropagation()}>
                  <IconBtn title="Remove stack" danger onClick={() => setRemoving(st)}>
                    <Trash2 size={13} />
                  </IconBtn>
                </span>
              </div>
              {open && (
                <div className={clsx('border-t border-edge bg-ink/40')}>
                  <StackDetail name={st.Name} />
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        busy={busy}
        title={`Remove stack ${removing?.Name}?`}
        body={
          <>
            Removes all services in <b className="text-txt">{removing?.Name}</b> (
            <span className="font-mono">docker stack rm</span>). Volumes, secrets and configs are kept.
          </>
        }
        onConfirm={async () => {
          if (!removing) return
          setBusy(true)
          try {
            await api.removeStack(removing.Name)
            setRemoving(null)
            setExpanded(null)
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
