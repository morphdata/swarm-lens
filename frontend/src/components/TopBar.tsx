import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Container, Globe, Pencil, Plus, RefreshCw } from 'lucide-react'
import { useApp } from '../store'
import { isWails } from '../api/client'
import { Btn, IconBtn } from './ui'

export function TopBar() {
  const { servers, activeId, setActive, refresh, openAddServer } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const active = servers.find((s) => s.id === activeId)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <header className="drag shrink-0 h-12 bg-panel border-b border-edge flex items-center gap-3 px-3">
      {isWails && <div className="w-14 shrink-0" /* traffic-light clearance */ />}
      <div className="flex items-center gap-2 select-none">
        <div className="w-6 h-6 rounded-md bg-accent/15 text-accent flex items-center justify-center">
          <Container size={14} />
        </div>
        <span className="font-semibold text-[13px] tracking-tight">Swarm Lens</span>
      </div>
      <div className="w-px h-5 bg-edge mx-1" />

      <div className="relative nodrag" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-panel2 border border-edge hover:border-edge2 min-w-[200px] transition-colors"
        >
          <Globe size={13} className="text-accent shrink-0" />
          {active ? (
            <span className="flex-1 text-left min-w-0">
              <span className="block text-xs font-medium leading-4 truncate">{active.name}</span>
              <span className="block text-[10px] text-mute leading-3 truncate">
                {active.user}@{active.host}:{active.port}
              </span>
            </span>
          ) : (
            <span className="flex-1 text-left text-xs text-mute">Select server…</span>
          )}
          <ChevronDown size={13} className="text-mute shrink-0" />
        </button>

        {open && (
          <div className="absolute left-0 mt-1 w-80 bg-panel2 border border-edge2 rounded-lg shadow-2xl z-50 overflow-hidden">
            <div className="px-3 pt-2.5 pb-1.5 text-[10px] uppercase tracking-wider text-dim font-semibold">
              Servers / contexts
            </div>
            <div className="max-h-72 overflow-y-auto pb-1">
              {servers.map((s) => (
                <div key={s.id} className="group flex items-center gap-1 px-1.5">
                  <button
                    onClick={async () => {
                      setOpen(false)
                      if (s.id === activeId) return
                      setBusy(true)
                      try {
                        await setActive(s.id)
                      } finally {
                        setBusy(false)
                      }
                    }}
                    className="flex-1 flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-edge/50 text-left"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.id === activeId ? 'bg-ok' : 'bg-dim'}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium leading-4 truncate">{s.name}</span>
                      <span className="block text-[10px] text-mute leading-3.5 truncate">
                        {s.user}@{s.host}:{s.port} · {s.auth}
                      </span>
                    </span>
                    {s.id === activeId && <Check size={13} className="text-ok shrink-0" />}
                  </button>
                  <IconBtn
                    title="Edit server"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      setOpen(false)
                      openAddServer(s)
                    }}
                  >
                    <Pencil size={12} />
                  </IconBtn>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setOpen(false)
                openAddServer(null)
              }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-accent hover:bg-edge/40 border-t border-edge"
            >
              <Plus size={13} /> Add server…
            </button>
          </div>
        )}
      </div>
      {busy && <span className="text-[11px] text-mute">switching context…</span>}

      <div className="flex-1" />
      <IconBtn title="Refresh all views" onClick={refresh} className="nodrag">
        <RefreshCw size={14} />
      </IconBtn>
      <Btn variant="primary" className="nodrag" onClick={() => openAddServer(null)}>
        <Plus size={13} /> Add server
      </Btn>
    </header>
  )
}
