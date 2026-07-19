import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { HostMetrics } from '../types'

/** Polls host metrics of the connected server, keeping a rolling history. */
export function useHostMetrics(activeId: string, tick: number, intervalMs = 3000) {
  const [current, setCurrent] = useState<HostMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<{ cpu: number[]; mem: number[] }>({ cpu: [], mem: [] })

  useEffect(() => {
    let stopped = false
    setCurrent(null)
    setHistory({ cpu: [], mem: [] })
    const load = async () => {
      try {
        const m = await api.getHostMetrics()
        if (stopped) return
        setCurrent(m)
        setError(null)
        setHistory((h) => ({
          cpu: [...h.cpu, m.cpuPercent].slice(-60),
          mem: [...h.mem, m.memTotal ? (m.memUsed / m.memTotal) * 100 : 0].slice(-60),
        }))
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e))
      }
    }
    load()
    const t = setInterval(load, intervalMs)
    return () => {
      stopped = true
      clearInterval(t)
    }
  }, [activeId, tick, intervalMs])

  return { current, history, error }
}
