import { Activity, Boxes, Clock, Container, Gauge as GaugeIcon, HardDrive, Layers, Server } from 'lucide-react'
import { useApp, useAsync } from '../store'
import { api } from '../api/client'
import { Badge, Card, ErrorBanner, FullSpinner, KV, SectionTitle, fmtBytes, fmtUptime } from '../components/ui'
import { Gauge, Sparkline } from '../components/Gauge'
import { useHostMetrics } from '../components/useHostMetrics'

function StatCard({
  icon: Icon, label, value, sub, onClick,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  label: string
  value: React.ReactNode
  sub?: string
  onClick?: () => void
}) {
  return (
    <Card
      className={`p-3.5 flex items-center gap-3 ${onClick ? 'cursor-pointer hover:border-edge2 transition-colors' : ''}`}
    >
      <div onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold leading-5 truncate">{value}</div>
          <div className="text-[11px] text-mute truncate">
            {label}
            {sub && <span className="text-dim"> · {sub}</span>}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function Dashboard() {
  const { activeId, tick, navigate } = useApp()
  const ov = useAsync(() => api.getOverview(), [activeId, tick])
  const hm = useHostMetrics(activeId, tick)

  if (ov.loading && !ov.data) return <FullSpinner label="Connecting over SSH…" />
  if (ov.error) return <ErrorBanner error={ov.error} onRetry={ov.reload} />
  if (!ov.data) return null

  const o = ov.data
  const info = o.info

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      {o.errors && o.errors.length > 0 && (
        <Card className="p-3 border-warn/30 bg-warn/5">
          <div className="text-xs text-warn font-medium mb-1">Some queries failed on this node</div>
          {o.errors.map((e, i) => (
            <div key={i} className="text-[11px] text-warn/80 font-mono select-text">{e}</div>
          ))}
          <div className="text-[11px] text-mute mt-1.5">
            Tip: connect to a swarm <span className="text-txt">manager</span> node for full cluster visibility.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-6 gap-3">
        <StatCard icon={HardDrive} label="Nodes" value={`${o.nodesReady}/${o.nodesTotal}`} sub="ready" onClick={() => navigate('nodes')} />
        <StatCard icon={Server} label="Managers" value={o.managers} onClick={() => navigate('nodes')} />
        <StatCard icon={Boxes} label="Services" value={o.services} onClick={() => navigate('services')} />
        <StatCard icon={Layers} label="Stacks" value={o.stacks} onClick={() => navigate('stacks')} />
        <StatCard icon={Container} label="Containers" value={info.ContainersRunning} sub={`${info.ContainersStopped} stopped`} onClick={() => navigate('containers')} />
        <StatCard icon={Activity} label="Images" value={info.Images} sub="on this host" />
      </div>

      <div className="grid grid-cols-3 gap-3 items-start">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>Swarm</SectionTitle>
            <Badge tone={o.swarmActive ? 'ok' : 'warn'}>{info.Swarm.LocalNodeState || 'unknown'}</Badge>
          </div>
          <KV k="Cluster" v={o.clusterName || 'default'} />
          <KV k="Cluster ID" v={info.Swarm.Cluster.ID || '—'} />
          <KV k="This node" v={`${info.Name} (${info.Swarm.NodeID || '—'})`} />
          <KV k="Node address" v={info.Swarm.NodeAddr} />
          <KV k="Role" v={o.isManager ? 'manager' : 'worker'} />
          <KV k="Server" v={`${o.serverName} · ${o.serverHost}`} mono={false} />
        </Card>

        <Card className="p-4">
          <SectionTitle>Docker daemon</SectionTitle>
          <KV k="Version" v={info.ServerVersion} />
          <KV k="OS" v={info.OperatingSystem} />
          <KV k="Kernel" v={info.KernelVersion} />
          <KV k="Architecture" v={info.Architecture} />
          <KV k="Storage driver" v={info.Driver} />
          <KV k="Docker root" v={info.DockerRootDir} />
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Host resources</SectionTitle>
            <span className="text-[10px] text-dim">{info.NCPU} CPUs · {fmtBytes(info.MemTotal)}</span>
          </div>
          {hm.current ? (
            <>
              <div className="flex justify-around mb-3">
                <Gauge value={hm.current.cpuPercent} label="CPU" />
                <Gauge
                  value={hm.current.memTotal ? (hm.current.memUsed / hm.current.memTotal) * 100 : 0}
                  label="Memory"
                  sub={`${fmtBytes(hm.current.memUsed)} / ${fmtBytes(hm.current.memTotal)}`}
                />
                <Gauge
                  value={hm.current.diskTotal ? (hm.current.diskUsed / hm.current.diskTotal) * 100 : 0}
                  label="Disk /"
                  sub={`${fmtBytes(hm.current.diskUsed)} / ${fmtBytes(hm.current.diskTotal)}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-panel2 rounded-md p-2">
                  <div className="text-[10px] text-mute mb-1 flex items-center gap-1"><GaugeIcon size={10} /> CPU history</div>
                  <Sparkline points={hm.history.cpu} width={180} height={34} max={100} />
                </div>
                <div className="bg-panel2 rounded-md p-2">
                  <div className="text-[10px] text-mute mb-1 flex items-center gap-1"><GaugeIcon size={10} /> Memory history</div>
                  <Sparkline points={hm.history.mem} width={180} height={34} max={100} color="#34d399" />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-[11px] text-mute">
                <span className="flex items-center gap-1"><Activity size={11} /> load {hm.current.load1.toFixed(2)} / {hm.current.load5.toFixed(2)} / {hm.current.load15.toFixed(2)}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> up {fmtUptime(hm.current.uptimeSeconds)}</span>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-dim">{hm.error ? 'Host metrics unavailable' : 'Collecting metrics…'}</div>
          )}
        </Card>
      </div>
    </div>
  )
}
