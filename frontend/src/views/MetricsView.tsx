import { useEffect, useState } from 'react'
import { Activity, Clock, Pause, Play } from 'lucide-react'
import { useApp } from '../store'
import { api } from '../api/client'
import type { StatsEntry } from '../types'
import { DataTable, type Column } from '../components/DataTable'
import { Btn, Card, PageHeader, SectionTitle, fmtBytes, fmtUptime } from '../components/ui'
import { Gauge, Sparkline } from '../components/Gauge'
import { useHostMetrics } from '../components/useHostMetrics'

function parsePct(s: string): number {
  const v = parseFloat((s || '').replace('%', ''))
  return isNaN(v) ? 0 : v
}

export function MetricsView() {
  const { activeId, tick } = useApp()
  const hm = useHostMetrics(activeId, tick)
  const [stats, setStats] = useState<StatsEntry[] | null>(null)
  const [statsErr, setStatsErr] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const s = await api.getStats()
        if (!stop) {
          setStats(s)
          setStatsErr(null)
        }
      } catch (e) {
        if (!stop) setStatsErr(e instanceof Error ? e.message : String(e))
      }
    }
    load()
    if (paused) return
    const t = setInterval(load, 3000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [activeId, tick, paused])

  const columns: Column<StatsEntry>[] = [
    {
      header: 'Name',
      value: (r) => r.Name,
      render: (r) => <span className="font-medium text-txt">{r.Name}</span>,
    },
    {
      header: 'CPU %',
      value: (r) => r.CPUPerc,
      className: 'w-40',
      render: (r) => {
        const v = parsePct(r.CPUPerc)
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full bg-edge overflow-hidden">
              <div
                className={`h-full rounded-full ${v > 80 ? 'bg-err' : v > 50 ? 'bg-warn' : 'bg-accent'}`}
                style={{ width: `${Math.min(100, v)}%` }}
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums">{r.CPUPerc}</span>
          </div>
        )
      },
    },
    { header: 'Mem usage / limit', value: (r) => r.MemUsage, render: (r) => <span className="font-mono text-[11px]">{r.MemUsage}</span> },
    { header: 'Mem %', value: (r) => r.MemPerc, render: (r) => <span className="font-mono text-[11px]">{r.MemPerc}</span> },
    { header: 'Net I/O', value: (r) => r.NetIO, render: (r) => <span className="font-mono text-[11px] text-mute">{r.NetIO}</span> },
    { header: 'Block I/O', value: (r) => r.BlockIO, render: (r) => <span className="font-mono text-[11px] text-mute">{r.BlockIO}</span> },
    { header: 'PIDs', value: (r) => r.PIDs, render: (r) => <span className="font-mono text-[11px]">{r.PIDs}</span> },
  ]

  return (
    <>
      <PageHeader
        title="Metrics"
        sub="Live resource usage of the connected host — refreshes every 3s"
        actions={
          <Btn onClick={() => setPaused((p) => !p)}>
            {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? 'Resume' : 'Pause'}
          </Btn>
        }
      />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Card className="shrink-0 mx-4 mb-3 p-4 flex items-center gap-6">
          <div className="flex gap-5">
            <Gauge value={hm.current?.cpuPercent ?? 0} label="CPU" />
            <Gauge
              value={hm.current && hm.current.memTotal ? (hm.current.memUsed / hm.current.memTotal) * 100 : 0}
              label="Memory"
              sub={hm.current ? `${fmtBytes(hm.current.memUsed)} / ${fmtBytes(hm.current.memTotal)}` : ''}
            />
            <Gauge
              value={hm.current && hm.current.diskTotal ? (hm.current.diskUsed / hm.current.diskTotal) * 100 : 0}
              label="Disk /"
              sub={hm.current ? `${fmtBytes(hm.current.diskUsed)} / ${fmtBytes(hm.current.diskTotal)}` : ''}
            />
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div>
              <SectionTitle>CPU history</SectionTitle>
              <Sparkline points={hm.history.cpu} width={260} height={44} max={100} />
            </div>
            <div>
              <SectionTitle>Memory history</SectionTitle>
              <Sparkline points={hm.history.mem} width={260} height={44} max={100} color="#34d399" />
            </div>
            <div className="col-span-2 flex items-center gap-4 text-[11px] text-mute">
              <span className="flex items-center gap-1">
                <Activity size={11} /> load {hm.current?.load1.toFixed(2) ?? '—'} / {hm.current?.load5.toFixed(2) ?? '—'} / {hm.current?.load15.toFixed(2) ?? '—'}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} /> up {hm.current ? fmtUptime(hm.current.uptimeSeconds) : '—'}
              </span>
            </div>
          </div>
        </Card>
        {statsErr && <div className="mx-4 mb-2 text-err text-xs font-mono select-text">{statsErr}</div>}
        <div className="flex-1 min-h-0 flex flex-col border-t border-edge">
          <DataTable
            columns={columns}
            rows={stats ?? []}
            keyFn={(r) => r.Container}
            searchPlaceholder="Search containers…"
            emptyTitle="No running containers on this host"
          />
        </div>
      </div>
    </>
  )
}
