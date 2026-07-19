// Types mirroring the Go backend (internal/docker, internal/store).

export interface Server {
  id: string
  name: string
  host: string
  port: number
  user: string
  auth: 'password' | 'key' | 'agent'
  password?: string
  keyPath?: string
  keyPassphrase?: string
  strictHostKey?: boolean
}

export interface NodeSummary {
  ID: string
  Hostname: string
  Status: string
  Availability: string
  ManagerStatus: string
  EngineVersion: string
  TLSStatus: string
}

export interface ServiceSummary {
  ID: string
  Name: string
  Mode: string
  Replicas: string
  Image: string
  Ports: string
}

export interface TaskSummary {
  ID: string
  Name: string
  Image: string
  Node: string
  DesiredState: string
  CurrentState: string
  Error: string
  Ports: string
}

export interface ContainerSummary {
  ID: string
  Image: string
  Command: string
  CreatedAt: string
  RunningFor: string
  Status: string
  State: string
  Ports: string
  Names: string
  Labels: string
  Mounts: string
  Networks: string
  LocalVolumes: string
}

export interface StackSummary {
  Name: string
  Services: string
  Orchestrator: string
}

export interface NetworkSummary {
  ID: string
  Name: string
  Driver: string
  Scope: string
  CreatedAt: string
  Internal: string
  IPv6: string
  Labels: string
}

export interface VolumeSummary {
  Driver: string
  Name: string
  Scope: string
  Mountpoint: string
  Labels: string
}

export interface SecretSummary {
  ID: string
  Name: string
  Driver: string
  CreatedAt: string
  UpdatedAt: string
  Labels: string
}

export interface ConfigSummary {
  ID: string
  Name: string
  CreatedAt: string
  UpdatedAt: string
  Labels: string
}

export interface StatsEntry {
  Container: string
  Name: string
  ID: string
  CPUPerc: string
  MemUsage: string
  MemPerc: string
  NetIO: string
  BlockIO: string
  PIDs: string
}

export interface SwarmInfo {
  NodeID: string
  NodeAddr: string
  LocalNodeState: string
  ControlAvailable: boolean
  Error: string
  RemoteManagers: { NodeID: string; Addr: string }[]
  Cluster: { ID: string; Spec: { Name: string } }
}

export interface DockerInfo {
  ID: string
  Name: string
  ServerVersion: string
  OperatingSystem: string
  OSType: string
  Architecture: string
  KernelVersion: string
  Driver: string
  DockerRootDir: string
  NCPU: number
  MemTotal: number
  Containers: number
  ContainersRunning: number
  ContainersPaused: number
  ContainersStopped: number
  Images: number
  Swarm: SwarmInfo
}

export interface Overview {
  info: DockerInfo
  isManager: boolean
  swarmActive: boolean
  clusterName: string
  nodesTotal: number
  nodesReady: number
  managers: number
  services: number
  stacks: number
  serverId: string
  serverName: string
  serverHost: string
  errors?: string[]
}

export interface HostMetrics {
  cpuPercent: number
  load1: number
  load5: number
  load15: number
  memTotal: number
  memUsed: number
  memAvailable: number
  diskTotal: number
  diskUsed: number
  diskAvailable: number
  uptimeSeconds: number
  collectedAt: string
}

export interface LogLine {
  stream: 'stdout' | 'stderr'
  line: string
}
