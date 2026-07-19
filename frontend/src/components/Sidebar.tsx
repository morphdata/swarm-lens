import {
  Activity, Boxes, Container, Database, HardDrive, KeyRound, Layers, LayoutDashboard, Network,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp, type ViewName } from '../store'
import { isWails } from '../api/client'

interface NavItem {
  view: ViewName
  label: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Overview',
    items: [
      { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { view: 'metrics', label: 'Metrics', icon: Activity },
    ],
  },
  {
    group: 'Cluster',
    items: [
      { view: 'nodes', label: 'Nodes', icon: HardDrive },
      { view: 'networks', label: 'Networks', icon: Network },
    ],
  },
  {
    group: 'Workloads',
    items: [
      { view: 'services', label: 'Services', icon: Boxes },
      { view: 'stacks', label: 'Stacks', icon: Layers },
      { view: 'containers', label: 'Containers', icon: Container },
    ],
  },
  {
    group: 'Configuration',
    items: [
      { view: 'volumes', label: 'Volumes', icon: Database },
      { view: 'configs', label: 'Secrets & Configs', icon: KeyRound },
    ],
  },
]

export function Sidebar() {
  const { route, navigate } = useApp()
  return (
    <aside className="w-52 shrink-0 bg-panel border-r border-edge flex flex-col overflow-y-auto py-3">
      {NAV.map((g) => (
        <div key={g.group} className="mb-3">
          <div className="px-4 mb-1 text-[10px] uppercase tracking-wider text-dim font-semibold">
            {g.group}
          </div>
          {g.items.map((it) => {
            const active = route.view === it.view
            return (
              <button
                key={it.view}
                onClick={() => navigate(it.view)}
                className={clsx(
                  'w-[calc(100%-12px)] mx-1.5 px-2.5 py-[7px] rounded-md flex items-center gap-2.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-mute hover:text-txt hover:bg-panel2',
                )}
              >
                <it.icon size={14} className="shrink-0" />
                {it.label}
              </button>
            )
          })}
        </div>
      ))}
      <div className="flex-1" />
      <div className="px-4 py-2 text-[10px] text-dim">
        {isWails ? 'Swarm Lens v1.0.0' : 'Browser preview · demo data'}
      </div>
    </aside>
  )
}
