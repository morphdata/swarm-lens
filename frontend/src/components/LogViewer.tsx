import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Pause, Play, Terminal, Trash2 } from 'lucide-react'
import { api, onEvent } from '../api/client'
import type { LogLine } from '../types'
import { Badge, Btn, IconBtn } from './ui'

const MAX_LINES = 5000
const TAILS = [100, 500, 1000, 5000]

interface Props {
  kind: 'service' | 'container'
  id: string
}

/**
 * Loads an initial log tail, then follows the live stream pushed by the
 * backend over Wails events ("logs:<kind>:<id>").
 */
export function LogViewer({ kind, id }: Props) {
  const [lines, setLines] = useState<LogLine[]>([])
  const [tail, setTail] = useState(500)
  const [paused, setPaused] = useState(false)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stick, setStick] = useState(true)

  const boxRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const bufferRef = useRef<LogLine[]>([])
  pausedRef.current = paused

  useEffect(() => {
    let disposed = false
    let off: (() => void) | undefined
    let offEnd: (() => void) | undefined

    setLines([])
    setEnded(false)
    setError(null)
    bufferRef.current = []

    const fetcher = kind === 'service' ? api.getServiceLogs : api.getContainerLogs
    fetcher(id, tail)
      .then((text) => {
        if (disposed) return
        const init: LogLine[] = text
          ? text.split('\n').map((line) => ({ stream: 'stdout' as const, line }))
          : []
        setLines(init.slice(-MAX_LINES))
      })
      .catch((e) => {
        if (!disposed) setError(e instanceof Error ? e.message : String(e))
      })

    api
      .startLogStream(kind, id, tail)
      .then(() => {
        if (disposed) return
        off = onEvent(`logs:${kind}:${id}`, (d: LogLine) => {
          if (pausedRef.current) {
            bufferRef.current.push(d)
            return
          }
          setLines((prev) =>
            prev.length >= MAX_LINES ? [...prev.slice(-(MAX_LINES - 1)), d] : [...prev, d],
          )
        })
        offEnd = onEvent(`logs:${kind}:${id}:end`, () => setEnded(true))
      })
      .catch((e) => {
        if (!disposed) setError(e instanceof Error ? e.message : String(e))
      })

    return () => {
      disposed = true
      off?.()
      offEnd?.()
      api.stopLogStream(kind, id)
    }
  }, [kind, id, tail])

  useEffect(() => {
    if (stick && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight
    }
  }, [lines, stick])

  const onScroll = () => {
    const el = boxRef.current
    if (!el) return
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 30)
  }

  const togglePause = () => {
    if (paused && bufferRef.current.length) {
      setLines((prev) => [...prev, ...bufferRef.current].slice(-MAX_LINES))
      bufferRef.current = []
    }
    setPaused(!paused)
  }

  return (
    <div className="relative h-full flex flex-col bg-[#090c10] rounded-lg border border-edge overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-edge bg-panel">
        <Terminal size={13} className="text-mute" />
        <span className="font-mono text-[11px] text-mute truncate">
          {kind} · {id}
        </span>
        {ended && <Badge tone="warn">stream ended</Badge>}
        {error && <span className="text-err text-[11px] truncate">{error}</span>}
        <div className="flex-1" />
        <span className="text-[10px] text-dim tabular-nums">{lines.length} lines</span>
        <select
          value={tail}
          onChange={(e) => setTail(Number(e.target.value))}
          title="Initial tail"
          className="bg-panel2 border border-edge rounded text-[11px] px-1.5 py-0.5 text-mute focus:outline-none"
        >
          {TAILS.map((t) => (
            <option key={t} value={t}>
              tail {t}
            </option>
          ))}
        </select>
        <IconBtn title={paused ? 'Resume' : 'Pause'} onClick={togglePause}>
          {paused ? <Play size={13} /> : <Pause size={13} />}
        </IconBtn>
        <IconBtn title="Clear" onClick={() => setLines([])}>
          <Trash2 size={13} />
        </IconBtn>
      </div>
      <div
        ref={boxRef}
        onScroll={onScroll}
        className="flex-1 min-h-0 overflow-auto px-3 py-2 font-mono text-[11px] leading-[1.65] select-text"
      >
        {lines.length === 0 && !error && (
          <div className="text-dim py-6 text-center">Waiting for logs…</div>
        )}
        {lines.map((l, i) => (
          <div key={i} className={l.stream === 'stderr' ? 'text-err/90' : 'text-txt/85'}>
            <span className="whitespace-pre-wrap break-all">{l.line}</span>
          </div>
        ))}
      </div>
      {!stick && (
        <Btn
          className="absolute bottom-3 right-4 shadow-lg"
          onClick={() => {
            setStick(true)
            boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight })
          }}
        >
          <ArrowDown size={12} /> Follow
        </Btn>
      )}
    </div>
  )
}
