// Mock backend used when the frontend runs in a plain browser (no Wails
// runtime). It powers UI development and the live preview with a realistic
// two-cluster demo dataset.
import type {
  Server, Overview, NodeSummary, ServiceSummary, TaskSummary, StackSummary,
  ContainerSummary, NetworkSummary, VolumeSummary, SecretSummary, ConfigSummary,
  StatsEntry, HostMetrics, DockerInfo,
} from '../types'
import type { Api } from './client'

const delay = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms + Math.random() * 250))

// ---------- event bus ----------

type Handler = (data: any) => void
const listeners = new Map<string, Set<Handler>>()

export function mockOnEvent(name: string, cb: Handler): () => void {
  if (!listeners.has(name)) listeners.set(name, new Set())
  listeners.get(name)!.add(cb)
  return () => {
    listeners.get(name)?.delete(cb)
  }
}

function emit(name: string, data: any) {
  listeners.get(name)?.forEach((cb) => {
    try {
      cb(data)
    } catch {
      /* noop */
    }
  })
}

// ---------- demo clusters ----------

interface ClusterState {
  info: DockerInfo
  nodes: NodeSummary[]
  services: ServiceSummary[]
  stacks: StackSummary[]
  stackOf: Record<string, string>
  tasks: Record<string, TaskSummary[]>
  containers: ContainerSummary[]
  networks: NetworkSummary[]
  volumes: VolumeSummary[]
  secrets: SecretSummary[]
  configs: ConfigSummary[]
  host: { cpu: number; memFrac: number; diskFrac: number; uptime: number }
  stats: Record<string, { cpu: number; memMiB: number; pids: number }>
}

function ago(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} minutes ago`
  if (h < 24) return `${Math.round(h)} hours ago`
  return `${Math.round(h / 24)} days ago`
}

function makeTasks(
  svc: string, image: string, replicas: number, nodes: string[], withFailed = false,
): TaskSummary[] {
  const tasks: TaskSummary[] = []
  for (let i = 0; i < replicas; i++) {
    const node = nodes[i % nodes.length]
    tasks.push({
      ID: `t${Math.random().toString(36).slice(2, 10)}${'x'.repeat(15)}`,
      Name: `${svc}.${i + 1}`,
      Image: image,
      Node: node,
      DesiredState: 'Running',
      CurrentState: `Running ${ago(6 + Math.random() * 96)}`,
      Error: '',
      Ports: '',
    })
  }
  if (withFailed) {
    tasks.push({
      ID: `t${Math.random().toString(36).slice(2, 10)}${'x'.repeat(15)}`,
      Name: `${svc}.${replicas + 1}`,
      Image: image,
      Node: nodes[0],
      DesiredState: 'Shutdown',
      CurrentState: `Failed ${ago(40)}`,
      Error: 'task: non-zero exit (137)',
      Ports: '',
    })
  }
  return tasks
}

function buildProdCluster(): ClusterState {
  const nodeNames = ['eu-mgr-1', 'eu-mgr-2', 'eu-wrk-1', 'eu-wrk-2']
  const services: ServiceSummary[] = [
    { ID: 'svc01edge', Name: 'edge_traefik', Mode: 'replicated', Replicas: '2/2', Image: 'traefik:v3.1.2', Ports: '*:80->80/tcp, *:443->443/tcp' },
    { ID: 'svc02web', Name: 'app_web', Mode: 'replicated', Replicas: '3/3', Image: 'nginx:1.27-alpine', Ports: '*:8080->8080/tcp' },
    { ID: 'svc03api', Name: 'app_api', Mode: 'replicated', Replicas: '3/3', Image: 'ghcr.io/acme/api:1.42.0', Ports: '*:9000->9000/tcp' },
    { ID: 'svc04wrk', Name: 'app_worker', Mode: 'replicated', Replicas: '2/2', Image: 'ghcr.io/acme/worker:1.42.0', Ports: '' },
    { ID: 'svc05pg', Name: 'data_postgres', Mode: 'replicated', Replicas: '1/1', Image: 'postgres:16.4-alpine', Ports: '5432/tcp' },
    { ID: 'svc06rds', Name: 'data_redis', Mode: 'replicated', Replicas: '1/1', Image: 'redis:7.4-alpine', Ports: '6379/tcp' },
    { ID: 'svc07exp', Name: 'monitoring_node-exporter', Mode: 'global', Replicas: '4/4', Image: 'prom/node-exporter:v1.8.2', Ports: '9100/tcp' },
  ]
  const stackOf: Record<string, string> = {
    edge_traefik: 'edge', app_web: 'app', app_api: 'app', app_worker: 'app',
    data_postgres: 'data', data_redis: 'data', 'monitoring_node-exporter': 'monitoring',
  }
  const tasks: Record<string, TaskSummary[]> = {}
  for (const s of services) {
    const n = s.Mode === 'global' ? 4 : parseInt(s.Replicas.split('/')[1], 10)
    tasks[s.Name] = makeTasks(s.Name, s.Image, n, nodeNames, s.Name === 'app_api')
  }
  return {
    info: {
      ID: 'DKR:PROD:EU:0001', Name: 'eu-mgr-1', ServerVersion: '26.1.4',
      OperatingSystem: 'Ubuntu 24.04.1 LTS', OSType: 'linux', Architecture: 'x86_64',
      KernelVersion: '6.8.0-47-generic', Driver: 'overlay2', DockerRootDir: '/var/lib/docker',
      NCPU: 4, MemTotal: 16688680960, Containers: 7, ContainersRunning: 5,
      ContainersPaused: 0, ContainersStopped: 2, Images: 23,
      Swarm: {
        NodeID: 'n0demomgr1eu', NodeAddr: '10.20.0.11', LocalNodeState: 'active',
        ControlAvailable: true, Error: '',
        RemoteManagers: [
          { NodeID: 'n0demomgr1eu', Addr: '10.20.0.11:2377' },
          { NodeID: 'n0demomgr2eu', Addr: '10.20.0.12:2377' },
        ],
        Cluster: { ID: 'clprod0001eu', Spec: { Name: 'prod-eu' } },
      },
    },
    nodes: [
      { ID: 'n0demomgr1eu', Hostname: 'eu-mgr-1', Status: 'Ready', Availability: 'Active', ManagerStatus: 'Leader', EngineVersion: '26.1.4', TLSStatus: 'Ready' },
      { ID: 'n0demomgr2eu', Hostname: 'eu-mgr-2', Status: 'Ready', Availability: 'Active', ManagerStatus: 'Reachable', EngineVersion: '26.1.4', TLSStatus: 'Ready' },
      { ID: 'n0demowrk1eu', Hostname: 'eu-wrk-1', Status: 'Ready', Availability: 'Active', ManagerStatus: '', EngineVersion: '26.1.4', TLSStatus: 'Ready' },
      { ID: 'n0demowrk2eu', Hostname: 'eu-wrk-2', Status: 'Ready', Availability: 'Drain', ManagerStatus: '', EngineVersion: '26.1.3', TLSStatus: 'Ready' },
    ],
    services,
    stacks: [
      { Name: 'app', Services: '3', Orchestrator: 'Swarm' },
      { Name: 'data', Services: '2', Orchestrator: 'Swarm' },
      { Name: 'edge', Services: '1', Orchestrator: 'Swarm' },
      { Name: 'monitoring', Services: '1', Orchestrator: 'Swarm' },
    ],
    stackOf,
    tasks,
    containers: [
      { ID: 'c0ntraefik01', Image: 'traefik:v3.1.2', Command: '/entrypoint.sh --api…', CreatedAt: '2026-07-10 09:12:44 +0000 UTC', RunningFor: '7 days ago', Status: 'Up 7 days', State: 'running', Ports: '0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp', Names: 'edge_traefik.1.q9xk2', Labels: 'com.docker.swarm.service.id=svc01edge', Mounts: 'edge_acme', Networks: 'ingress', LocalVolumes: '1' },
      { ID: 'c0napi02xmpl', Image: 'ghcr.io/acme/api:1.42.0', Command: '/bin/api serve', CreatedAt: '2026-07-14 18:02:11 +0000 UTC', RunningFor: '3 days ago', Status: 'Up 3 days', State: 'running', Ports: '9000/tcp', Names: 'app_api.2.m41v8', Labels: 'com.docker.swarm.service.id=svc03api', Mounts: '', Networks: 'app_backend', LocalVolumes: '0' },
      { ID: 'c0nweb01xmpl', Image: 'nginx:1.27-alpine', Command: '/docker-entrypoint.…', CreatedAt: '2026-07-14 18:02:10 +0000 UTC', RunningFor: '3 days ago', Status: 'Up 3 days', State: 'running', Ports: '8080/tcp', Names: 'app_web.1.z77q0', Labels: 'com.docker.swarm.service.id=svc02web', Mounts: '', Networks: 'app_frontend', LocalVolumes: '0' },
      { ID: 'c0nexp01xmpl', Image: 'prom/node-exporter:v1.8.2', Command: '/bin/node_exporter', CreatedAt: '2026-06-30 11:40:03 +0000 UTC', RunningFor: '2 weeks ago', Status: 'Up 2 weeks', State: 'running', Ports: '9100/tcp', Names: 'monitoring_node-exporter.n0demomgr1eu.ab12', Labels: 'com.docker.swarm.service.id=svc07exp', Mounts: '', Networks: 'host', LocalVolumes: '0' },
      { ID: 'c0noldbackup', Image: 'ghcr.io/acme/backup:0.9.0', Command: '/bin/backup', CreatedAt: '2026-07-01 03:00:00 +0000 UTC', RunningFor: '2 weeks ago', Status: 'Exited (0) 2 weeks ago', State: 'exited', Ports: '', Names: 'nightly-backup', Labels: '', Mounts: 'backup_data', Networks: 'bridge', LocalVolumes: '1' },
    ],
    networks: [
      { ID: 'net01bridge', Name: 'bridge', Driver: 'bridge', Scope: 'local', CreatedAt: '2026-06-01T08:00:00Z', Internal: 'false', IPv6: 'false', Labels: '' },
      { ID: 'net02host', Name: 'host', Driver: 'host', Scope: 'local', CreatedAt: '2026-06-01T08:00:00Z', Internal: 'false', IPv6: 'false', Labels: '' },
      { ID: 'net03ingress', Name: 'ingress', Driver: 'overlay', Scope: 'swarm', CreatedAt: '2026-06-01T08:01:00Z', Internal: 'false', IPv6: 'false', Labels: '' },
      { ID: 'net04front', Name: 'app_frontend', Driver: 'overlay', Scope: 'swarm', CreatedAt: '2026-06-10T10:00:00Z', Internal: 'false', IPv6: 'false', Labels: 'com.docker.stack.namespace=app' },
      { ID: 'net05back', Name: 'app_backend', Driver: 'overlay', Scope: 'swarm', CreatedAt: '2026-06-10T10:00:00Z', Internal: 'false', IPv6: 'false', Labels: 'com.docker.stack.namespace=app' },
      { ID: 'net06data', Name: 'data_backend', Driver: 'overlay', Scope: 'swarm', CreatedAt: '2026-06-10T10:05:00Z', Internal: 'true', IPv6: 'false', Labels: 'com.docker.stack.namespace=data' },
    ],
    volumes: [
      { Driver: 'local', Name: 'data_pgdata', Scope: 'local', Mountpoint: '/var/lib/docker/volumes/data_pgdata/_data', Labels: 'com.docker.stack.namespace=data' },
      { Driver: 'local', Name: 'data_redis-data', Scope: 'local', Mountpoint: '/var/lib/docker/volumes/data_redis-data/_data', Labels: 'com.docker.stack.namespace=data' },
      { Driver: 'local', Name: 'edge_acme', Scope: 'local', Mountpoint: '/var/lib/docker/volumes/edge_acme/_data', Labels: 'com.docker.stack.namespace=edge' },
      { Driver: 'local', Name: 'backup_data', Scope: 'local', Mountpoint: '/var/lib/docker/volumes/backup_data/_data', Labels: '' },
    ],
    secrets: [
      { ID: 'sec01dbpw', Name: 'db_password', Driver: '', CreatedAt: '2026-06-10T09:58:00Z', UpdatedAt: '2026-06-10T09:58:00Z', Labels: 'com.docker.stack.namespace=data' },
      { ID: 'sec02tls', Name: 'tls_certificate', Driver: '', CreatedAt: '2026-06-12T12:00:00Z', UpdatedAt: '2026-07-01T12:00:00Z', Labels: 'com.docker.stack.namespace=edge' },
      { ID: 'sec03reg', Name: 'registry_credentials', Driver: '', CreatedAt: '2026-06-10T09:59:00Z', UpdatedAt: '2026-06-10T09:59:00Z', Labels: '' },
    ],
    configs: [
      { ID: 'cfg01nginx', Name: 'nginx_conf', CreatedAt: '2026-06-10T10:00:00Z', UpdatedAt: '2026-07-14T18:00:00Z', Labels: 'com.docker.stack.namespace=app' },
      { ID: 'cfg02traefik', Name: 'traefik_dynamic', CreatedAt: '2026-06-12T12:00:00Z', UpdatedAt: '2026-07-01T12:00:00Z', Labels: 'com.docker.stack.namespace=edge' },
      { ID: 'cfg03pg', Name: 'postgres_conf', CreatedAt: '2026-06-10T10:01:00Z', UpdatedAt: '2026-06-10T10:01:00Z', Labels: 'com.docker.stack.namespace=data' },
    ],
    host: { cpu: 23, memFrac: 0.44, diskFrac: 0.57, uptime: 2.6e6 },
    stats: {
      'edge_traefik.1.q9xk2': { cpu: 3.2, memMiB: 96, pids: 21 },
      'app_api.2.m41v8': { cpu: 14.5, memMiB: 380, pids: 34 },
      'app_web.1.z77q0': { cpu: 1.1, memMiB: 28, pids: 9 },
      'monitoring_node-exporter.n0demomgr1eu.ab12': { cpu: 0.4, memMiB: 18, pids: 8 },
    },
  }
}

function buildStagingCluster(): ClusterState {
  const nodeNames = ['us-mgr-1', 'us-wrk-1']
  const services: ServiceSummary[] = [
    { ID: 'svc10web', Name: 'app_web', Mode: 'replicated', Replicas: '2/2', Image: 'nginx:1.27-alpine', Ports: '*:8080->8080/tcp' },
    { ID: 'svc11api', Name: 'app_api', Mode: 'replicated', Replicas: '2/2', Image: 'ghcr.io/acme/api:1.43.0-rc.2', Ports: '*:9000->9000/tcp' },
    { ID: 'svc12pg', Name: 'data_postgres', Mode: 'replicated', Replicas: '1/1', Image: 'postgres:16.4-alpine', Ports: '5432/tcp' },
  ]
  const stackOf: Record<string, string> = { app_web: 'app', app_api: 'app', data_postgres: 'data' }
  const tasks: Record<string, TaskSummary[]> = {}
  for (const s of services) {
    tasks[s.Name] = makeTasks(s.Name, s.Image, parseInt(s.Replicas.split('/')[1], 10), nodeNames)
  }
  return {
    info: {
      ID: 'DKR:STG:US:0001', Name: 'us-mgr-1', ServerVersion: '27.0.3',
      OperatingSystem: 'Debian GNU/Linux 12 (bookworm)', OSType: 'linux', Architecture: 'aarch64',
      KernelVersion: '6.1.0-23-arm64', Driver: 'overlay2', DockerRootDir: '/var/lib/docker',
      NCPU: 2, MemTotal: 8360345600, Containers: 4, ContainersRunning: 3,
      ContainersPaused: 0, ContainersStopped: 1, Images: 11,
      Swarm: {
        NodeID: 'n0demomgr1us', NodeAddr: '10.30.0.5', LocalNodeState: 'active',
        ControlAvailable: true, Error: '',
        RemoteManagers: [{ NodeID: 'n0demomgr1us', Addr: '10.30.0.5:2377' }],
        Cluster: { ID: 'clstg0001us', Spec: { Name: 'staging-us' } },
      },
    },
    nodes: [
      { ID: 'n0demomgr1us', Hostname: 'us-mgr-1', Status: 'Ready', Availability: 'Active', ManagerStatus: 'Leader', EngineVersion: '27.0.3', TLSStatus: 'Ready' },
      { ID: 'n0demowrk1us', Hostname: 'us-wrk-1', Status: 'Ready', Availability: 'Active', ManagerStatus: '', EngineVersion: '27.0.3', TLSStatus: 'Ready' },
    ],
    services,
    stacks: [
      { Name: 'app', Services: '2', Orchestrator: 'Swarm' },
      { Name: 'data', Services: '1', Orchestrator: 'Swarm' },
    ],
    stackOf,
    tasks,
    containers: [
      { ID: 'c1napi01xmpl', Image: 'ghcr.io/acme/api:1.43.0-rc.2', Command: '/bin/api serve', CreatedAt: '2026-07-16 22:14:01 +0000 UTC', RunningFor: '10 hours ago', Status: 'Up 10 hours', State: 'running', Ports: '9000/tcp', Names: 'app_api.1.k02z9', Labels: 'com.docker.swarm.service.id=svc11api', Mounts: '', Networks: 'app_backend', LocalVolumes: '0' },
      { ID: 'c1nweb01xmpl', Image: 'nginx:1.27-alpine', Command: '/docker-entrypoint.…', CreatedAt: '2026-07-16 22:14:00 +0000 UTC', RunningFor: '10 hours ago', Status: 'Up 10 hours', State: 'running', Ports: '8080/tcp', Names: 'app_web.1.p55w2', Labels: 'com.docker.swarm.service.id=svc10web', Mounts: '', Networks: 'app_frontend', LocalVolumes: '0' },
      { ID: 'c1npg01xmpl', Image: 'postgres:16.4-alpine', Command: 'docker-entrypoint.s…', CreatedAt: '2026-07-16 22:13:55 +0000 UTC', RunningFor: '10 hours ago', Status: 'Up 10 hours', State: 'running', Ports: '5432/tcp', Names: 'data_postgres.1.e88d1', Labels: 'com.docker.swarm.service.id=svc12pg', Mounts: 'data_pgdata', Networks: 'data_backend', LocalVolumes: '1' },
    ],
    networks: [
      { ID: 'net11bridge', Name: 'bridge', Driver: 'bridge', Scope: 'local', CreatedAt: '2026-07-01T08:00:00Z', Internal: 'false', IPv6: 'false', Labels: '' },
      { ID: 'net12ingress', Name: 'ingress', Driver: 'overlay', Scope: 'swarm', CreatedAt: '2026-07-01T08:01:00Z', Internal: 'false', IPv6: 'false', Labels: '' },
      { ID: 'net13front', Name: 'app_frontend', Driver: 'overlay', Scope: 'swarm', CreatedAt: '2026-07-01T09:00:00Z', Internal: 'false', IPv6: 'false', Labels: 'com.docker.stack.namespace=app' },
      { ID: 'net14back', Name: 'app_backend', Driver: 'overlay', Scope: 'swarm', CreatedAt: '2026-07-01T09:00:00Z', Internal: 'false', IPv6: 'false', Labels: 'com.docker.stack.namespace=app' },
      { ID: 'net15data', Name: 'data_backend', Driver: 'overlay', Scope: 'swarm', CreatedAt: '2026-07-01T09:05:00Z', Internal: 'true', IPv6: 'false', Labels: 'com.docker.stack.namespace=data' },
    ],
    volumes: [
      { Driver: 'local', Name: 'data_pgdata', Scope: 'local', Mountpoint: '/var/lib/docker/volumes/data_pgdata/_data', Labels: 'com.docker.stack.namespace=data' },
    ],
    secrets: [
      { ID: 'sec11dbpw', Name: 'db_password', Driver: '', CreatedAt: '2026-07-01T09:00:00Z', UpdatedAt: '2026-07-01T09:00:00Z', Labels: 'com.docker.stack.namespace=data' },
    ],
    configs: [
      { ID: 'cfg11nginx', Name: 'nginx_conf', CreatedAt: '2026-07-01T09:00:00Z', UpdatedAt: '2026-07-16T22:00:00Z', Labels: 'com.docker.stack.namespace=app' },
    ],
    host: { cpu: 12, memFrac: 0.51, diskFrac: 0.38, uptime: 1.4e6 },
    stats: {
      'app_api.1.k02z9': { cpu: 6.8, memMiB: 290, pids: 30 },
      'app_web.1.p55w2': { cpu: 0.8, memMiB: 22, pids: 9 },
      'data_postgres.1.e88d1': { cpu: 2.4, memMiB: 210, pids: 24 },
    },
  }
}

// ---------- servers & clusters ----------

let servers: Server[] = [
  { id: 'demo-eu', name: 'prod-eu-1', host: '10.20.0.11', port: 22, user: 'deploy', auth: 'key', keyPath: '~/.ssh/id_ed25519' },
  { id: 'demo-us', name: 'staging-us-1', host: '10.30.0.5', port: 22, user: 'ubuntu', auth: 'agent' },
]
let activeId = 'demo-eu'

const clusters: Record<string, ClusterState> = {
  'demo-eu': buildProdCluster(),
  'demo-us': buildStagingCluster(),
}

function cluster(): ClusterState {
  return clusters[activeId] ?? clusters['demo-eu']
}

// ---------- log generation ----------

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const paths = ['/v1/orders', '/v1/users', '/v1/orders/4821', '/healthz', '/v1/search?q=shoes', '/v1/cart', '/assets/app.js', '/api/health']
const ips = ['10.0.1.24', '10.0.2.8', '172.18.0.4', '10.20.0.31', '10.0.1.55']

function logBody(svc: string): string {
  const t = new Date().toISOString()
  if (svc.includes('web')) {
    return `${rand(ips)} - - [${t}] "GET ${rand(paths)} HTTP/1.1" ${rand([200, 200, 200, 304, 404])} ${Math.floor(Math.random() * 4000)} "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"`
  }
  if (svc.includes('api')) {
    return JSON.stringify({ level: 'info', ts: t, msg: 'request handled', method: 'GET', path: rand(paths), status: 200, dur_ms: +(Math.random() * 90).toFixed(1) })
  }
  if (svc.includes('worker')) {
    return `[${t}] INFO job_${Math.floor(Math.random() * 9000 + 1000)} processed in ${Math.floor(Math.random() * 800)}ms (queue=default, depth=${Math.floor(Math.random() * 12)})`
  }
  if (svc.includes('postgres')) {
    return rand([
      `${t} UTC [88] LOG:  checkpoint starting: time`,
      `${t} UTC [88] LOG:  checkpoint complete: wrote ${Math.floor(Math.random() * 900)} buffers (${(Math.random() * 8).toFixed(1)}%)`,
      `${t} UTC [201] LOG:  connection received: host=10.0.1.24 port=51244`,
      `${t} UTC [201] LOG:  connection authorized: user=app database=appdb`,
    ])
  }
  if (svc.includes('redis')) {
    return `1:M ${new Date().toUTCString()} * ${Math.floor(Math.random() * 9000)} changes in 60 seconds. Saving...`
  }
  if (svc.includes('traefik')) {
    return JSON.stringify({ level: 'info', time: t, msg: 'request', method: 'GET', path: rand(paths), router: 'web-secure', status: 200, duration: `${Math.floor(Math.random() * 60)}ms` })
  }
  return `${t} level=info msg="scrape completed" duration=${(Math.random() * 0.4).toFixed(3)}s`
}

function taskRef(svc: string): string {
  const st = cluster()
  const tasks = st.tasks[svc] ?? []
  const running = tasks.filter((t) => t.DesiredState === 'Running')
  const t = running.length ? rand(running) : null
  const short = t ? t.ID.slice(0, 8) : 'standalone'
  const node = t ? t.Node : st.nodes[0]?.Hostname ?? 'node'
  return `${svc}.${t ? t.Name.split('.').pop() : '1'}.${short}@${node}`
}

function logLine(svc: string): string {
  return `${new Date().toISOString()} ${taskRef(svc)}    | ${logBody(svc)}`
}

const streamTimers = new Map<string, ReturnType<typeof setInterval>>()

// ---------- inspect payloads ----------

function inspectPayload(kind: string, id: string): unknown {
  const st = cluster()
  if (kind === 'node') {
    const n = st.nodes.find((x) => x.ID === id || x.Hostname === id) ?? st.nodes[0]
    const mgr = !!n.ManagerStatus
    return [{
      ID: n.ID, Version: { Index: 8123 },
      CreatedAt: '2026-06-01T08:00:00.000000000Z', UpdatedAt: '2026-07-14T18:00:00.000000000Z',
      Spec: { Name: n.Hostname, Role: mgr ? 'manager' : 'worker', Availability: n.Availability.toLowerCase(), Labels: mgr ? { region: 'eu' } : {} },
      Description: {
        Hostname: n.Hostname,
        Platform: { Architecture: st.info.Architecture, OS: 'linux' },
        Resources: { NanoCPUs: st.info.NCPU * 1e9, MemoryBytes: st.info.MemTotal },
        Engine: { EngineVersion: n.EngineVersion, Plugins: [{ Type: 'Log', Name: 'json-file' }, { Type: 'Network', Name: 'overlay' }, { Type: 'Volume', Name: 'local' }] },
      },
      Status: { State: n.Status.toLowerCase(), Addr: '10.20.0.11' },
      ...(mgr ? { ManagerStatus: { Leader: n.ManagerStatus === 'Leader', Reachability: 'reachable', Addr: '10.20.0.11:2377' } } : {}),
    }]
  }
  if (kind === 'service') {
    const s = st.services.find((x) => x.Name === id || x.ID === id)
    const name = s?.Name ?? id
    const replicas = s ? parseInt(s.Replicas.split('/')[1], 10) : 1
    return [{
      ID: s?.ID ?? 'svc' + id, Version: { Index: 9104 },
      CreatedAt: '2026-06-10T10:00:00.000000000Z', UpdatedAt: '2026-07-14T18:02:11.000000000Z',
      Spec: {
        Name: name,
        Labels: { 'com.docker.stack.namespace': st.stackOf[name] ?? '' },
        TaskTemplate: {
          ContainerSpec: { Image: s?.Image ?? 'unknown', Env: ['NODE_ENV=production'], Mounts: [], Secrets: name.includes('postgres') ? [{ SecretName: 'db_password' }] : [] },
          RestartPolicy: { Condition: 'any', MaxAttempts: 0 },
          Placement: name.includes('postgres') ? { Constraints: ['node.role == manager'] } : {},
          Resources: { Limits: name.includes('api') ? { NanoCPUs: 1e9, MemoryBytes: 536870912 } : {} },
        },
        Mode: s?.Mode === 'global' ? { Global: {} } : { Replicated: { Replicas: replicas } },
        UpdateConfig: { Parallelism: 1, FailureAction: 'pause', Order: 'start-first' },
        Networks: [{ Target: 'app_backend' }],
      },
      Endpoint: { Spec: { Mode: 'vip' }, Ports: s?.Ports ? [{ Protocol: 'tcp', PublishedPort: 8080, TargetPort: 8080, PublishMode: 'ingress' }] : [] },
      UpdateStatus: { State: 'completed', Message: 'update completed' },
    }]
  }
  if (kind === 'container') {
    const c = st.containers.find((x) => x.ID.startsWith(id) || x.Names === id)
    return [{
      Id: (c?.ID ?? id) + 'f'.repeat(40),
      Name: '/' + (c?.Names ?? id),
      Created: c?.CreatedAt ?? new Date().toISOString(),
      State: { Status: c?.State ?? 'running', Running: c?.State === 'running', Pid: 2412, ExitCode: 0, StartedAt: c?.CreatedAt ?? '', FinishedAt: '0001-01-01T00:00:00Z' },
      Config: { Image: c?.Image ?? '', Env: ['PATH=/usr/local/sbin:/usr/local/bin'], Labels: { 'com.docker.swarm.service.id': c?.Labels ?? '' } },
      HostConfig: { LogConfig: { Type: 'json-file' }, RestartPolicy: { Name: '' }, NetworkMode: 'default' },
      NetworkSettings: { Networks: { [c?.Networks || 'bridge']: { IPAddress: '10.0.1.24', Gateway: '10.0.1.1' } } },
      Mounts: c?.Mounts ? [{ Type: 'volume', Name: c.Mounts, Source: `/var/lib/docker/volumes/${c.Mounts}/_data`, Destination: '/data' }] : [],
    }]
  }
  if (kind === 'network') {
    const n = st.networks.find((x) => x.Name === id || x.ID === id)
    return [{
      Id: n?.ID ?? id, Name: n?.Name ?? id, Driver: n?.Driver ?? 'overlay', Scope: n?.Scope ?? 'swarm',
      Created: n?.CreatedAt ?? '', Internal: n?.Internal === 'true', EnableIPv6: false,
      IPAM: { Driver: 'default', Config: [{ Subnet: '10.0.1.0/24', Gateway: '10.0.1.1' }] },
      Containers: {}, Labels: n?.Labels ? { 'com.docker.stack.namespace': n.Labels.split('=').pop() } : {},
    }]
  }
  if (kind === 'volume') {
    const v = st.volumes.find((x) => x.Name === id)
    return [{
      Name: v?.Name ?? id, Driver: 'local', Mountpoint: v?.Mountpoint ?? `/var/lib/docker/volumes/${id}/_data`,
      CreatedAt: '2026-06-10T10:00:00Z', Scope: 'local',
      Labels: v?.Labels ? { 'com.docker.stack.namespace': v.Labels.split('=').pop() } : {},
      Options: {}, Status: {},
    }]
  }
  if (kind === 'secret' || kind === 'config') {
    const list = kind === 'secret' ? st.secrets : st.configs
    const item = list.find((x) => x.Name === id || x.ID === id)
    return [{
      ID: item?.ID ?? id, Version: { Index: 4310 },
      CreatedAt: item?.CreatedAt ?? '', UpdatedAt: item?.UpdatedAt ?? '',
      Spec: { Name: item?.Name ?? id, Labels: item?.Labels ? { 'com.docker.stack.namespace': item.Labels.split('=').pop() } : {} },
    }]
  }
  return [{ id }]
}

// ---------- mock api ----------

export const mockApi: Api = {
  async listServers() {
    await delay(80)
    return servers
  },
  async saveServer(s) {
    await delay()
    const out = { ...s, id: s.id || Math.random().toString(36).slice(2, 10) }
    const i = servers.findIndex((x) => x.id === out.id)
    if (i >= 0) servers[i] = out
    else servers.push(out)
    if (!activeId) activeId = out.id
    return out
  },
  async removeServer(id) {
    await delay()
    servers = servers.filter((x) => x.id !== id)
    if (activeId === id) activeId = servers[0]?.id ?? ''
  },
  async testConnection(s) {
    await delay(700)
    if (!s.host) throw new Error('dial tcp :22: connect: connection refused')
    return `Docker 26.1.4 · swarm active · manager node · 4 CPUs · 15.6 GB RAM`
  },
  async getActiveContext() {
    await delay(40)
    return activeId
  },
  async setActiveContext(id) {
    await delay(60)
    activeId = id
  },

  async getOverview() {
    await delay()
    const st = cluster()
    const ov: Overview = {
      info: st.info,
      isManager: true,
      swarmActive: true,
      clusterName: st.info.Swarm.Cluster.Spec.Name,
      nodesTotal: st.nodes.length,
      nodesReady: st.nodes.filter((n) => n.Status === 'Ready').length,
      managers: st.nodes.filter((n) => n.ManagerStatus !== '').length,
      services: st.services.length,
      stacks: st.stacks.length,
      serverId: activeId,
      serverName: servers.find((s) => s.id === activeId)?.name ?? '',
      serverHost: (() => {
        const s = servers.find((x) => x.id === activeId)
        return s ? `${s.user}@${s.host}:${s.port}` : ''
      })(),
    }
    return ov
  },
  async listNodes() {
    await delay()
    return cluster().nodes
  },
  async listServices() {
    await delay()
    return cluster().services
  },
  async listServiceTasks(id) {
    await delay()
    return cluster().tasks[id] ?? []
  },
  async listStacks() {
    await delay()
    return cluster().stacks
  },
  async listStackServices(name) {
    await delay()
    const st = cluster()
    return st.services.filter((s) => st.stackOf[s.Name] === name)
  },
  async listStackTasks(name) {
    await delay()
    const st = cluster()
    const out: TaskSummary[] = []
    for (const s of st.services) if (st.stackOf[s.Name] === name) out.push(...(st.tasks[s.Name] ?? []))
    return out
  },
  async listContainers(all) {
    await delay()
    const cs = cluster().containers
    return all ? cs : cs.filter((c) => c.State === 'running')
  },
  async listNetworks() {
    await delay()
    return cluster().networks
  },
  async listVolumes() {
    await delay()
    return cluster().volumes
  },
  async listSecrets() {
    await delay()
    return cluster().secrets
  },
  async listConfigs() {
    await delay()
    return cluster().configs
  },
  async inspect(kind, id) {
    await delay()
    return JSON.stringify(inspectPayload(kind, id), null, 2)
  },

  async getServiceLogs(id, tail) {
    await delay()
    const n = Math.min(tail, 60)
    return Array.from({ length: n }, () => logLine(id)).join('\n')
  },
  async getContainerLogs(id, tail) {
    await delay()
    const c = cluster().containers.find((x) => x.ID.startsWith(id) || x.Names === id)
    const svc = c?.Labels.match(/service.id=\w+/) ? c.Names.split('.')[0] : id
    const n = Math.min(tail, 60)
    return Array.from({ length: n }, () => `${new Date().toISOString()} ${logBody(svc)}`).join('\n')
  },
  async startLogStream(kind, id, _tail) {
    await delay(60)
    const key = `${kind}:${id}`
    if (streamTimers.has(key)) return
    const timer = setInterval(() => {
      const lines = Math.floor(Math.random() * 3) + 1
      for (let i = 0; i < lines; i++) {
        const body = kind === 'service' ? logLine(id) : `${new Date().toISOString()} ${logBody(id)}`
        emit(`logs:${key}`, { stream: Math.random() < 0.06 ? 'stderr' : 'stdout', line: body })
      }
    }, 900)
    streamTimers.set(key, timer)
  },
  async stopLogStream(kind, id) {
    const key = `${kind}:${id}`
    const t = streamTimers.get(key)
    if (t) clearInterval(t)
    streamTimers.delete(key)
  },

  async getStats() {
    await delay()
    const st = cluster()
    const entries: StatsEntry[] = []
    for (const c of st.containers) {
      if (c.State !== 'running') continue
      const base = st.stats[c.Names] ?? { cpu: 1, memMiB: 64, pids: 10 }
      base.cpu = Math.max(0.05, Math.min(95, base.cpu + (Math.random() - 0.5) * base.cpu * 0.5))
      base.memMiB = Math.max(8, base.memMiB + (Math.random() - 0.5) * 8)
      entries.push({
        Container: c.ID,
        Name: c.Names,
        ID: c.ID,
        CPUPerc: `${base.cpu.toFixed(2)}%`,
        MemUsage: `${base.memMiB.toFixed(1)}MiB / ${(st.info.MemTotal / 1048576 / 1024).toFixed(2)}GiB`,
        MemPerc: `${((base.memMiB * 1048576 * 100) / st.info.MemTotal).toFixed(2)}%`,
        NetIO: `${(Math.random() * 900 + 40).toFixed(1)}MB / ${(Math.random() * 300 + 20).toFixed(1)}MB`,
        BlockIO: `${(Math.random() * 400).toFixed(1)}MB / ${(Math.random() * 900).toFixed(1)}MB`,
        PIDs: String(base.pids),
      })
    }
    return entries
  },
  async getHostMetrics() {
    await delay(300)
    const st = cluster()
    const h = st.host
    h.cpu = Math.max(2, Math.min(96, h.cpu + (Math.random() - 0.5) * 9))
    h.memFrac = Math.max(0.15, Math.min(0.92, h.memFrac + (Math.random() - 0.5) * 0.02))
    h.uptime += 3
    const total = st.info.MemTotal
    const used = total * h.memFrac
    const disk = 214748364800
    const m: HostMetrics = {
      cpuPercent: +h.cpu.toFixed(1),
      load1: +((h.cpu / 100) * st.info.NCPU * (0.9 + Math.random() * 0.2)).toFixed(2),
      load5: +((h.cpu / 100) * st.info.NCPU * 0.95).toFixed(2),
      load15: +((h.cpu / 100) * st.info.NCPU * 0.9).toFixed(2),
      memTotal: total,
      memUsed: Math.round(used),
      memAvailable: Math.round(total - used),
      diskTotal: disk,
      diskUsed: Math.round(disk * h.diskFrac),
      diskAvailable: Math.round(disk * (1 - h.diskFrac)),
      uptimeSeconds: h.uptime,
      collectedAt: new Date().toISOString(),
    }
    return m
  },

  async scaleService(id, replicas) {
    await delay()
    const st = cluster()
    const s = st.services.find((x) => x.ID === id || x.Name === id)
    if (!s) throw new Error(`service ${id} not found`)
    s.Replicas = `${replicas}/${replicas}`
    const nodes = st.nodes.map((n) => n.Hostname)
    st.tasks[s.Name] = makeTasks(s.Name, s.Image, replicas, nodes)
  },
  async removeService(id) {
    await delay()
    const st = cluster()
    const s = st.services.find((x) => x.ID === id || x.Name === id)
    st.services = st.services.filter((x) => x !== s)
    if (s) {
      delete st.tasks[s.Name]
      delete st.stackOf[s.Name]
    }
  },
  async restartService(id) {
    await delay()
    const st = cluster()
    const s = st.services.find((x) => x.ID === id || x.Name === id)
    if (!s) throw new Error(`service ${id} not found`)
    const nodes = st.nodes.map((n) => n.Hostname)
    st.tasks[s.Name] = makeTasks(s.Name, s.Image, parseInt(s.Replicas.split('/')[1], 10), nodes)
  },
  async removeStack(name) {
    await delay()
    const st = cluster()
    st.stacks = st.stacks.filter((x) => x.Name !== name)
    for (const s of [...st.services]) {
      if (st.stackOf[s.Name] === name) {
        delete st.tasks[s.Name]
        delete st.stackOf[s.Name]
        st.services = st.services.filter((x) => x !== s)
      }
    }
  },
  async removeContainer(id, _force) {
    await delay()
    const st = cluster()
    st.containers = st.containers.filter((c) => !c.ID.startsWith(id) && c.Names !== id)
  },
  async removeNode(id, _force) {
    await delay()
    const st = cluster()
    st.nodes = st.nodes.filter((n) => n.ID !== id && n.Hostname !== id)
  },
  async setNodeAvailability(id, availability) {
    await delay()
    const st = cluster()
    const n = st.nodes.find((x) => x.ID === id || x.Hostname === id)
    if (n) n.Availability = availability[0].toUpperCase() + availability.slice(1)
  },
}
