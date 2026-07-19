import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { useApp, useAsync } from '../store'
import { api } from '../api/client'
import type { TaskSummary } from '../types'
import { DataTable, type Column } from '../components/DataTable'
import { JsonView } from '../components/JsonView'
import { LogViewer } from '../components/LogViewer'
import { Badge, Card, ErrorBanner, FullSpinner, StatusBadge } from '../components/ui'
import { ReplicaBadge, ServiceActionButtons } from './Services'

type Tab = 'tasks' | 'logs' | 'inspect'

export function ServiceDetail({ id }: { id: string }) {
  const { activeId, tick, navigate, refresh } = useApp()
  const [tab, setTab] = useState<Tab>('tasks')

  const svcs = useAsync(() => api.listServices(), [activeId, tick])
  const svc = svcs.data?.find((s) => s.Name === id || s.ID === id)
  const tasks = useAsync(() => api.listServiceTasks(id), [activeId, tick, id])
  const insp = useAsync(() => api.inspect('service', id), [activeId, id])

  const taskColumns: Column<TaskSummary>[] = [
    { header: 'Name', value: (r) => r.Name, render: (r) => <span className="font-medium">{r.Name}</span> },
    { header: 'Node', value: (r) => r.Node },
    {
      header: 'Image',
      value: (r) => r.Image,
      className: 'max-w-[240px]',
      render: (r) => <span className="font-mono text-[11px] text-mute block truncate">{r.Image}</span>,
    },
    { header: 'Desired', value: (r) => r.DesiredState, render: (r) => <StatusBadge status={r.DesiredState} /> },
    { header: 'Current', value: (r) => r.CurrentState, render: (r) => <StatusBadge status={r.CurrentState.split(' ')[0]} /> },
    {
      header: 'Error',
      value: (r) => r.Error,
      className: 'max-w-[220px]',
      render: (r) => (r.Error ? <span className="text-err text-[11px] block truncate">{r.Error}</span> : <span className="text-dim">—</span>),
    },
  ]

  return (
    <>
      <div className="shrink-0 px-4 pt-3.5 pb-3">
        <button onClick={() => navigate('services')} className="flex items-center gap-1 text-xs text-mute hover:text-txt mb-1.5">
          <ArrowLeft size={12} /> Services
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[15px] font-semibold tracking-tight">{svc?.Name ?? id}</h1>
          {svc && (
            <>
              <Badge tone={svc.Mode === 'global' ? 'accent' : 'dim'}>{svc.Mode}</Badge>
              <ReplicaBadge replicas={svc.Replicas} />
              <span className="font-mono text-[11px] text-mute">{svc.Image}</span>
            </>
          )}
          <div className="flex-1" />
          {svc && (
            <ServiceActionButtons
              svc={svc}
              onChanged={() => { svcs.reload(); tasks.reload(); refresh() }}
              onRemoved={() => navigate('services')}
            />
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 flex items-center gap-1 border-b border-edge">
        {(['tasks', 'logs', 'inspect'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-3 py-2 text-xs capitalize border-b-2 -mb-px transition-colors',
              tab === t ? 'border-accent text-accent' : 'border-transparent text-mute hover:text-txt',
            )}
          >
            {t}
            {t === 'tasks' && tasks.data && <span className="ml-1.5 text-dim">{tasks.data.length}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {tab === 'tasks' && (
          <>
            {tasks.loading && !tasks.data ? (
              <FullSpinner label="Loading tasks…" />
            ) : tasks.error ? (
              <ErrorBanner error={tasks.error} onRetry={tasks.reload} />
            ) : (
              <div className="flex-1 min-h-0 flex flex-col pt-2.5">
                <DataTable
                  columns={taskColumns}
                  rows={tasks.data ?? []}
                  keyFn={(r) => r.ID}
                  searchPlaceholder="Search tasks…"
                  emptyTitle="No tasks"
                />
              </div>
            )}
          </>
        )}
        {tab === 'logs' && (
          <div className="flex-1 min-h-0 p-4">
            <LogViewer kind="service" id={id} />
          </div>
        )}
        {tab === 'inspect' && (
          <div className="flex-1 min-h-0 overflow-auto p-4">
            {insp.loading && !insp.data ? (
              <FullSpinner label="Inspecting…" />
            ) : insp.error ? (
              <ErrorBanner error={insp.error} onRetry={insp.reload} />
            ) : (
              <Card className="p-3">
                <JsonView raw={insp.data ?? ''} />
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}
