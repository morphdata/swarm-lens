// Package docker talks to the Docker CLI on a remote host over SSH and
// parses its JSON output into typed structures.
package docker

// Field names mirror the Docker CLI's `{{json .}}` output so they
// unmarshal directly; keep the capitalized JSON tags.

type NodeSummary struct {
	ID            string `json:"ID"`
	Hostname      string `json:"Hostname"`
	Status        string `json:"Status"`
	Availability  string `json:"Availability"`
	ManagerStatus string `json:"ManagerStatus"`
	EngineVersion string `json:"EngineVersion"`
	TLSStatus     string `json:"TLSStatus"`
}

type ServiceSummary struct {
	ID       string `json:"ID"`
	Name     string `json:"Name"`
	Mode     string `json:"Mode"`
	Replicas string `json:"Replicas"`
	Image    string `json:"Image"`
	Ports    string `json:"Ports"`
}

type TaskSummary struct {
	ID           string `json:"ID"`
	Name         string `json:"Name"`
	Image        string `json:"Image"`
	Node         string `json:"Node"`
	DesiredState string `json:"DesiredState"`
	CurrentState string `json:"CurrentState"`
	Error        string `json:"Error"`
	Ports        string `json:"Ports"`
}

type ContainerSummary struct {
	ID           string `json:"ID"`
	Image        string `json:"Image"`
	Command      string `json:"Command"`
	CreatedAt    string `json:"CreatedAt"`
	RunningFor   string `json:"RunningFor"`
	Status       string `json:"Status"`
	State        string `json:"State"`
	Ports        string `json:"Ports"`
	Names        string `json:"Names"`
	Labels       string `json:"Labels"`
	Mounts       string `json:"Mounts"`
	Networks     string `json:"Networks"`
	LocalVolumes string `json:"LocalVolumes"`
}

type StackSummary struct {
	Name         string `json:"Name"`
	Services     string `json:"Services"`
	Orchestrator string `json:"Orchestrator"`
}

type NetworkSummary struct {
	ID        string `json:"ID"`
	Name      string `json:"Name"`
	Driver    string `json:"Driver"`
	Scope     string `json:"Scope"`
	CreatedAt string `json:"CreatedAt"`
	Internal  string `json:"Internal"`
	IPv6      string `json:"IPv6"`
	Labels    string `json:"Labels"`
}

type VolumeSummary struct {
	Driver     string `json:"Driver"`
	Name       string `json:"Name"`
	Scope      string `json:"Scope"`
	Mountpoint string `json:"Mountpoint"`
	Labels     string `json:"Labels"`
}

type SecretSummary struct {
	ID        string `json:"ID"`
	Name      string `json:"Name"`
	Driver    string `json:"Driver"`
	CreatedAt string `json:"CreatedAt"`
	UpdatedAt string `json:"UpdatedAt"`
	Labels    string `json:"Labels"`
}

type ConfigSummary struct {
	ID        string `json:"ID"`
	Name      string `json:"Name"`
	CreatedAt string `json:"CreatedAt"`
	UpdatedAt string `json:"UpdatedAt"`
	Labels    string `json:"Labels"`
}

type StatsEntry struct {
	Container string `json:"Container"`
	Name      string `json:"Name"`
	ID        string `json:"ID"`
	CPUPerc   string `json:"CPUPerc"`
	MemUsage  string `json:"MemUsage"`
	MemPerc   string `json:"MemPerc"`
	NetIO     string `json:"NetIO"`
	BlockIO   string `json:"BlockIO"`
	PIDs      string `json:"PIDs"`
}

type SwarmInfo struct {
	NodeID           string `json:"NodeID"`
	NodeAddr         string `json:"NodeAddr"`
	LocalNodeState   string `json:"LocalNodeState"`
	ControlAvailable bool   `json:"ControlAvailable"`
	Error            string `json:"Error"`
	RemoteManagers   []struct {
		NodeID string `json:"NodeID"`
		Addr   string `json:"Addr"`
	} `json:"RemoteManagers"`
	Cluster struct {
		ID   string `json:"ID"`
		Spec struct {
			Name string `json:"Name"`
		} `json:"Spec"`
	} `json:"Cluster"`
}

type Info struct {
	ID                string    `json:"ID"`
	Name              string    `json:"Name"`
	ServerVersion     string    `json:"ServerVersion"`
	OperatingSystem   string    `json:"OperatingSystem"`
	OSType            string    `json:"OSType"`
	Architecture      string    `json:"Architecture"`
	KernelVersion     string    `json:"KernelVersion"`
	Driver            string    `json:"Driver"`
	DockerRootDir     string    `json:"DockerRootDir"`
	NCPU              int       `json:"NCPU"`
	MemTotal          int64     `json:"MemTotal"`
	Containers        int       `json:"Containers"`
	ContainersRunning int       `json:"ContainersRunning"`
	ContainersPaused  int       `json:"ContainersPaused"`
	ContainersStopped int       `json:"ContainersStopped"`
	Images            int       `json:"Images"`
	Swarm             SwarmInfo `json:"Swarm"`
}

// Overview aggregates everything the dashboard needs in one call.
type Overview struct {
	Info        Info     `json:"info"`
	IsManager   bool     `json:"isManager"`
	SwarmActive bool     `json:"swarmActive"`
	ClusterName string   `json:"clusterName"`
	NodesTotal  int      `json:"nodesTotal"`
	NodesReady  int      `json:"nodesReady"`
	Managers    int      `json:"managers"`
	Services    int      `json:"services"`
	Stacks      int      `json:"stacks"`
	ServerID    string   `json:"serverId"`
	ServerName  string   `json:"serverName"`
	ServerHost  string   `json:"serverHost"`
	Errors      []string `json:"errors,omitempty"`
}

// LogLine is streamed to the frontend over Wails events.
type LogLine struct {
	Stream string `json:"stream"`
	Line   string `json:"line"`
}
