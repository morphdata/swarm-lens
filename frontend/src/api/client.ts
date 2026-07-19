import type {
  Server, Overview, NodeSummary, ServiceSummary, TaskSummary, StackSummary,
  ContainerSummary, NetworkSummary, VolumeSummary, SecretSummary, ConfigSummary,
  StatsEntry, HostMetrics,
} from '../types'
import { mockApi, mockOnEvent } from './mock'

declare global {
  interface Window {
    go?: any
    runtime?: any
  }
}

/** Api mirrors the bound Go methods on main.App (see app.go). */
export interface Api {
  listServers(): Promise<Server[]>
  saveServer(s: Server): Promise<Server>
  removeServer(id: string): Promise<void>
  testConnection(s: Server): Promise<string>
  getActiveContext(): Promise<string>
  setActiveContext(id: string): Promise<void>

  getOverview(): Promise<Overview>
  listNodes(): Promise<NodeSummary[]>
  listServices(): Promise<ServiceSummary[]>
  listServiceTasks(id: string): Promise<TaskSummary[]>
  listStacks(): Promise<StackSummary[]>
  listStackServices(name: string): Promise<ServiceSummary[]>
  listStackTasks(name: string): Promise<TaskSummary[]>
  listContainers(all: boolean): Promise<ContainerSummary[]>
  listNetworks(): Promise<NetworkSummary[]>
  listVolumes(): Promise<VolumeSummary[]>
  listSecrets(): Promise<SecretSummary[]>
  listConfigs(): Promise<ConfigSummary[]>
  inspect(kind: string, id: string): Promise<string>

  getServiceLogs(id: string, tail: number): Promise<string>
  getContainerLogs(id: string, tail: number): Promise<string>
  startLogStream(kind: 'service' | 'container', id: string, tail: number): Promise<void>
  stopLogStream(kind: 'service' | 'container', id: string): Promise<void>

  getStats(): Promise<StatsEntry[]>
  getHostMetrics(): Promise<HostMetrics>

  scaleService(id: string, replicas: number): Promise<void>
  removeService(id: string): Promise<void>
  restartService(id: string): Promise<void>
  removeStack(name: string): Promise<void>
  removeContainer(id: string, force: boolean): Promise<void>
  removeNode(id: string, force: boolean): Promise<void>
  setNodeAvailability(id: string, availability: string): Promise<void>
}

const A = () => window.go.main.App

const wailsApi: Api = {
  listServers: () => A().ListServers(),
  saveServer: (s) => A().SaveServer(s),
  removeServer: (id) => A().RemoveServer(id),
  testConnection: (s) => A().TestConnection(s),
  getActiveContext: () => A().GetActiveContext(),
  setActiveContext: (id) => A().SetActiveContext(id),
  getOverview: () => A().GetOverview(),
  listNodes: () => A().ListNodes(),
  listServices: () => A().ListServices(),
  listServiceTasks: (id) => A().ListServiceTasks(id),
  listStacks: () => A().ListStacks(),
  listStackServices: (n) => A().ListStackServices(n),
  listStackTasks: (n) => A().ListStackTasks(n),
  listContainers: (all) => A().ListContainers(all),
  listNetworks: () => A().ListNetworks(),
  listVolumes: () => A().ListVolumes(),
  listSecrets: () => A().ListSecrets(),
  listConfigs: () => A().ListConfigs(),
  inspect: (k, id) => A().Inspect(k, id),
  getServiceLogs: (id, tail) => A().GetServiceLogs(id, tail),
  getContainerLogs: (id, tail) => A().GetContainerLogs(id, tail),
  startLogStream: (k, id, tail) => A().StartLogStream(k, id, tail),
  stopLogStream: (k, id) => A().StopLogStream(k, id),
  getStats: () => A().GetStats(),
  getHostMetrics: () => A().GetHostMetrics(),
  scaleService: (id, r) => A().ScaleService(id, r),
  removeService: (id) => A().RemoveService(id),
  restartService: (id) => A().RestartService(id),
  removeStack: (n) => A().RemoveStack(n),
  removeContainer: (id, f) => A().RemoveContainer(id, f),
  removeNode: (id, f) => A().RemoveNode(id, f),
  setNodeAvailability: (id, a) => A().SetNodeAvailability(id, a),
}

export const isWails =
  typeof window !== 'undefined' &&
  !!(window.go && window.go.main && window.go.main.App)

/**
 * Subscribe to a backend event (Wails runtime event in the app,
 * mock event bus in the browser). Returns an unsubscribe function.
 */
export function onEvent(name: string, cb: (data: any) => void): () => void {
  if (isWails && window.runtime) {
    window.runtime.EventsOn(name, cb)
    return () => window.runtime.EventsOff(name)
  }
  return mockOnEvent(name, cb)
}

export const api: Api = isWails ? wailsApi : mockApi
