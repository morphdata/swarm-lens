import { create } from 'zustand'
import { api } from './api/client'
import type { Server } from './types'

export type ViewName =
  | 'dashboard'
  | 'nodes'
  | 'services'
  | 'stacks'
  | 'containers'
  | 'networks'
  | 'volumes'
  | 'configs'
  | 'metrics'

export interface Route {
  view: ViewName
  param?: string
}

interface AppState {
  servers: Server[]
  activeId: string
  route: Route
  tick: number
  loaded: boolean
  addServerOpen: boolean
  editingServer: Server | null

  init(): Promise<void>
  navigate(view: ViewName, param?: string): void
  setActive(id: string): Promise<void>
  reloadServers(): Promise<void>
  refresh(): void
  openAddServer(edit?: Server | null): void
  closeAddServer(): void
}

export const useApp = create<AppState>((set, get) => ({
  servers: [],
  activeId: '',
  route: { view: 'dashboard' },
  tick: 0,
  loaded: false,
  addServerOpen: false,
  editingServer: null,

  async init() {
    try {
      const [servers, activeId] = await Promise.all([api.listServers(), api.getActiveContext()])
      set({ servers, activeId, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  navigate(view, param) {
    set({ route: { view, param } })
  },
  async setActive(id) {
    await api.setActiveContext(id)
    set({ activeId: id, route: { view: 'dashboard' }, tick: get().tick + 1 })
  },
  async reloadServers() {
    const [servers, activeId] = await Promise.all([api.listServers(), api.getActiveContext()])
    set({ servers, activeId })
  },
  refresh() {
    set({ tick: get().tick + 1 })
  },
  openAddServer(edit = null) {
    set({ addServerOpen: true, editingServer: edit })
  },
  closeAddServer() {
    set({ addServerOpen: false, editingServer: null })
  },
}))

// ---- small async hook ----

import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  })
  const counter = useRef(0)
  const [localTick, setLocalTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    const id = ++counter.current
    setState((s) => ({ ...s, loading: true, error: null }))
    fnRef
      .current()
      .then((data) => {
        if (counter.current === id) setState({ data, error: null, loading: false })
      })
      .catch((e) => {
        if (counter.current === id)
          setState({ data: null, error: e instanceof Error ? e.message : String(e), loading: false })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, localTick])

  const reload = useCallback(() => setLocalTick((t) => t + 1), [])
  return { ...state, reload }
}
