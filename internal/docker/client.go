package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"swarmlens/internal/sshx"
	"swarmlens/internal/store"
)

const cmdTimeout = 30 * time.Second

var idPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$`)

// ValidID guards against shell injection in identifiers interpolated into
// remote commands.
func ValidID(id string) error {
	if !idPattern.MatchString(id) {
		return fmt.Errorf("invalid identifier: %q", id)
	}
	return nil
}

// Client runs docker CLI commands on one server over SSH.
type Client struct {
	mgr *sshx.Manager
	srv store.Server
}

// NewClient creates a Docker client bound to a server.
func NewClient(mgr *sshx.Manager, srv store.Server) *Client {
	return &Client{mgr: mgr, srv: srv}
}

func (c *Client) run(ctx context.Context, cmd string) (string, error) {
	stdout, _, err := c.mgr.Run(ctx, c.srv, cmd, "", cmdTimeout)
	return stdout, err
}

func (c *Client) runStdin(ctx context.Context, cmd, stdin string) (string, error) {
	stdout, _, err := c.mgr.Run(ctx, c.srv, cmd, stdin, cmdTimeout)
	return stdout, err
}

// jsonLines parses the one-JSON-object-per-line format produced by
// `docker ... --format '{{json .}}'`.
func jsonLines[T any](out string) []T {
	var items []T
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var v T
		if err := json.Unmarshal([]byte(line), &v); err == nil {
			items = append(items, v)
		}
	}
	return items
}

// Info returns `docker info`.
func (c *Client) Info(ctx context.Context) (*Info, error) {
	out, err := c.run(ctx, "docker info --format '{{json .}}'")
	if err != nil {
		return nil, err
	}
	var info Info
	if err := json.Unmarshal([]byte(out), &info); err != nil {
		return nil, fmt.Errorf("parse docker info: %w", err)
	}
	return &info, nil
}

func (c *Client) Nodes(ctx context.Context) ([]NodeSummary, error) {
	out, err := c.run(ctx, "docker node ls --format '{{json .}}'")
	if err != nil {
		return nil, err
	}
	return jsonLines[NodeSummary](out), nil
}

func (c *Client) Services(ctx context.Context) ([]ServiceSummary, error) {
	out, err := c.run(ctx, "docker service ls --format '{{json .}}'")
	if err != nil {
		return nil, err
	}
	return jsonLines[ServiceSummary](out), nil
}

func (c *Client) ServiceTasks(ctx context.Context, id string) ([]TaskSummary, error) {
	if err := ValidID(id); err != nil {
		return nil, err
	}
	out, err := c.run(ctx, fmt.Sprintf("docker service ps %s --no-trunc --format '{{json .}}'", id))
	if err != nil {
		return nil, err
	}
	return jsonLines[TaskSummary](out), nil
}

func (c *Client) Stacks(ctx context.Context) ([]StackSummary, error) {
	out, err := c.run(ctx, "docker stack ls --format '{{json .}}'")
	if err != nil {
		return nil, err
	}
	return jsonLines[StackSummary](out), nil
}

func (c *Client) StackServices(ctx context.Context, name string) ([]ServiceSummary, error) {
	if err := ValidID(name); err != nil {
		return nil, err
	}
	out, err := c.run(ctx, fmt.Sprintf("docker stack services %s --format '{{json .}}'", name))
	if err != nil {
		return nil, err
	}
	return jsonLines[ServiceSummary](out), nil
}

func (c *Client) StackTasks(ctx context.Context, name string) ([]TaskSummary, error) {
	if err := ValidID(name); err != nil {
		return nil, err
	}
	out, err := c.run(ctx, fmt.Sprintf("docker stack ps %s --no-trunc --format '{{json .}}'", name))
	if err != nil {
		return nil, err
	}
	return jsonLines[TaskSummary](out), nil
}

func (c *Client) Containers(ctx context.Context, all bool) ([]ContainerSummary, error) {
	cmd := "docker ps --format '{{json .}}'"
	if all {
		cmd = "docker ps -a --format '{{json .}}'"
	}
	out, err := c.run(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return jsonLines[ContainerSummary](out), nil
}

func (c *Client) Networks(ctx context.Context) ([]NetworkSummary, error) {
	out, err := c.run(ctx, "docker network ls --format '{{json .}}'")
	if err != nil {
		return nil, err
	}
	return jsonLines[NetworkSummary](out), nil
}

func (c *Client) Volumes(ctx context.Context) ([]VolumeSummary, error) {
	out, err := c.run(ctx, "docker volume ls --format '{{json .}}'")
	if err != nil {
		return nil, err
	}
	return jsonLines[VolumeSummary](out), nil
}

func (c *Client) Secrets(ctx context.Context) ([]SecretSummary, error) {
	out, err := c.run(ctx, "docker secret ls --format '{{json .}}'")
	if err != nil {
		return nil, err
	}
	return jsonLines[SecretSummary](out), nil
}

func (c *Client) Configs(ctx context.Context) ([]ConfigSummary, error) {
	out, err := c.run(ctx, "docker config ls --format '{{json .}}'")
	if err != nil {
		return nil, err
	}
	return jsonLines[ConfigSummary](out), nil
}

// Stats returns one-shot container resource usage from `docker stats`.
func (c *Client) Stats(ctx context.Context) ([]StatsEntry, error) {
	out, err := c.run(ctx, "docker stats --no-stream --format '{{json .}}'")
	if err != nil {
		return nil, err
	}
	return jsonLines[StatsEntry](out), nil
}

var inspectKinds = map[string]string{
	"node":      "docker node inspect %s",
	"service":   "docker service inspect %s",
	"container": "docker container inspect %s",
	"network":   "docker network inspect %s",
	"volume":    "docker volume inspect %s",
	"secret":    "docker secret inspect %s",
	"config":    "docker config inspect %s",
}

// Inspect returns the raw JSON of `docker <kind> inspect <id>`.
func (c *Client) Inspect(ctx context.Context, kind, id string) (string, error) {
	tmpl, ok := inspectKinds[kind]
	if !ok {
		return "", fmt.Errorf("unsupported inspect kind %q", kind)
	}
	if err := ValidID(id); err != nil {
		return "", err
	}
	return c.run(ctx, fmt.Sprintf(tmpl, id))
}

// ServiceLogs returns the last `tail` log lines of a service.
func (c *Client) ServiceLogs(ctx context.Context, id string, tail int) (string, error) {
	if err := ValidID(id); err != nil {
		return "", err
	}
	if tail <= 0 {
		tail = 200
	}
	return c.run(ctx, fmt.Sprintf("docker service logs --timestamps --tail %d %s", tail, id))
}

// ContainerLogs returns the last `tail` log lines of a container.
func (c *Client) ContainerLogs(ctx context.Context, id string, tail int) (string, error) {
	if err := ValidID(id); err != nil {
		return "", err
	}
	if tail <= 0 {
		tail = 200
	}
	return c.run(ctx, fmt.Sprintf("docker logs --timestamps --tail %d %s", tail, id))
}

// StreamServiceLogs follows a service's logs until ctx is cancelled.
func (c *Client) StreamServiceLogs(ctx context.Context, id string, tail int, onLine func(isErr bool, line string)) error {
	if err := ValidID(id); err != nil {
		return err
	}
	return c.mgr.RunStream(ctx, c.srv,
		fmt.Sprintf("docker service logs --follow --timestamps --tail %d %s", tail, id), onLine)
}

// StreamContainerLogs follows a container's logs until ctx is cancelled.
func (c *Client) StreamContainerLogs(ctx context.Context, id string, tail int, onLine func(isErr bool, line string)) error {
	if err := ValidID(id); err != nil {
		return err
	}
	return c.mgr.RunStream(ctx, c.srv,
		fmt.Sprintf("docker logs --follow --timestamps --tail %d %s", tail, id), onLine)
}

// ---- actions ----

func (c *Client) ScaleService(ctx context.Context, id string, replicas int) error {
	if err := ValidID(id); err != nil {
		return err
	}
	if replicas < 0 {
		return fmt.Errorf("replicas must be >= 0")
	}
	_, err := c.run(ctx, fmt.Sprintf("docker service scale %s=%d", id, replicas))
	return err
}

func (c *Client) RemoveService(ctx context.Context, id string) error {
	if err := ValidID(id); err != nil {
		return err
	}
	_, err := c.run(ctx, fmt.Sprintf("docker service rm %s", id))
	return err
}

// ForceUpdateService triggers a rolling restart of every task.
func (c *Client) ForceUpdateService(ctx context.Context, id string) error {
	if err := ValidID(id); err != nil {
		return err
	}
	_, err := c.run(ctx, fmt.Sprintf("docker service update --force %s", id))
	return err
}

func (c *Client) RemoveStack(ctx context.Context, name string) error {
	if err := ValidID(name); err != nil {
		return err
	}
	_, err := c.run(ctx, fmt.Sprintf("docker stack rm %s", name))
	return err
}

func (c *Client) RemoveContainer(ctx context.Context, id string, force bool) error {
	if err := ValidID(id); err != nil {
		return err
	}
	flag := ""
	if force {
		flag = " -f"
	}
	_, err := c.run(ctx, fmt.Sprintf("docker rm%s %s", flag, id))
	return err
}

func (c *Client) RemoveNode(ctx context.Context, id string, force bool) error {
	if err := ValidID(id); err != nil {
		return err
	}
	flag := ""
	if force {
		flag = " --force"
	}
	_, err := c.run(ctx, fmt.Sprintf("docker node rm%s %s", flag, id))
	return err
}

// SetNodeAvailability sets a node to active, pause or drain.
func (c *Client) SetNodeAvailability(ctx context.Context, id, availability string) error {
	if err := ValidID(id); err != nil {
		return err
	}
	switch availability {
	case "active", "pause", "drain":
	default:
		return fmt.Errorf("availability must be active, pause or drain")
	}
	_, err := c.run(ctx, fmt.Sprintf("docker node update --availability %s %s", availability, id))
	return err
}

// Overview fans out the dashboard queries in parallel; per-section errors
// are collected rather than failing the whole call (e.g. on workers).
func (c *Client) Overview(ctx context.Context) (*Overview, error) {
	info, err := c.Info(ctx)
	if err != nil {
		return nil, err
	}
	ov := &Overview{
		Info:        *info,
		IsManager:   info.Swarm.ControlAvailable,
		SwarmActive: info.Swarm.LocalNodeState == "active",
		ClusterName: info.Swarm.Cluster.Spec.Name,
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	addErr := func(prefix string, err error) {
		if err == nil {
			return
		}
		mu.Lock()
		ov.Errors = append(ov.Errors, fmt.Sprintf("%s: %s", prefix, err.Error()))
		mu.Unlock()
	}

	wg.Add(3)
	go func() {
		defer wg.Done()
		nodes, err := c.Nodes(ctx)
		if err != nil {
			addErr("nodes", err)
			return
		}
		mu.Lock()
		ov.NodesTotal = len(nodes)
		for _, n := range nodes {
			if strings.EqualFold(n.Status, "Ready") {
				ov.NodesReady++
			}
			if n.ManagerStatus != "" {
				ov.Managers++
			}
		}
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		svcs, err := c.Services(ctx)
		if err != nil {
			addErr("services", err)
			return
		}
		mu.Lock()
		ov.Services = len(svcs)
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		stacks, err := c.Stacks(ctx)
		if err != nil {
			addErr("stacks", err)
			return
		}
		mu.Lock()
		ov.Stacks = len(stacks)
		mu.Unlock()
	}()
	wg.Wait()
	return ov, nil
}
