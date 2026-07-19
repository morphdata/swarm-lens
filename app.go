package main

import (
	"context"
	"errors"
	"fmt"
	"sync"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"swarmlens/internal/docker"
	"swarmlens/internal/sshx"
	"swarmlens/internal/store"
)

// App is the struct bound to the frontend. Every exported method becomes a
// JS-callable binding at window.go.main.App.<Method>.
type App struct {
	ctx   context.Context
	store *store.Store
	ssh   *sshx.Manager

	streamMu sync.Mutex
	streams  map[string]context.CancelFunc
}

// NewApp loads the persisted server registry and creates the app.
func NewApp() *App {
	path, err := store.DefaultPath()
	if err != nil {
		path = "swarm-lens-servers.json"
	}
	st, err := store.Load(path)
	if err != nil {
		st = store.New(path)
	}
	return &App{
		store:   st,
		ssh:     sshx.NewManager(),
		streams: make(map[string]context.CancelFunc),
	}
}

func (a *App) startup(ctx context.Context) { a.ctx = ctx }

func (a *App) shutdown(ctx context.Context) {
	a.streamMu.Lock()
	for _, cancel := range a.streams {
		cancel()
	}
	a.streams = make(map[string]context.CancelFunc)
	a.streamMu.Unlock()
	a.ssh.CloseAll()
}

func (a *App) ctxOrBg() context.Context {
	if a.ctx != nil {
		return a.ctx
	}
	return context.Background()
}

func (a *App) activeClient() (*docker.Client, error) {
	id := a.store.Active()
	if id == "" {
		return nil, errors.New("no active server — add one from the top bar")
	}
	srv, ok := a.store.Get(id)
	if !ok {
		return nil, errors.New("the active server no longer exists")
	}
	return docker.NewClient(a.ssh, srv), nil
}

// ---- server & context management ----

// ListServers returns every configured server.
func (a *App) ListServers() []store.Server { return a.store.List() }

// SaveServer creates or updates a server and returns the stored record.
func (a *App) SaveServer(s store.Server) (store.Server, error) {
	if s.Host == "" || s.User == "" {
		return s, errors.New("host and user are required")
	}
	if s.Name == "" {
		s.Name = s.Host
	}
	if s.Port == 0 {
		s.Port = 22
	}
	if s.Auth == "" {
		s.Auth = store.AuthAgent
	}
	out, err := a.store.Upsert(s)
	if err != nil {
		return out, err
	}
	a.ssh.Disconnect(out.ID) // force re-dial with the new credentials
	return out, nil
}

// RemoveServer deletes a server and its pooled connection.
func (a *App) RemoveServer(id string) error {
	a.ssh.Disconnect(id)
	return a.store.Remove(id)
}

// GetActiveContext returns the id of the active server.
func (a *App) GetActiveContext() string { return a.store.Active() }

// SetActiveContext switches the active server.
func (a *App) SetActiveContext(id string) error {
	if _, ok := a.store.Get(id); !ok {
		return errors.New("unknown server")
	}
	return a.store.SetActive(id)
}

// TestConnection dials a (possibly unsaved) server config and returns a
// human-readable summary of the Docker daemon it finds.
func (a *App) TestConnection(s store.Server) (string, error) {
	if s.Host == "" || s.User == "" {
		return "", errors.New("host and user are required")
	}
	if s.Port == 0 {
		s.Port = 22
	}
	if s.ID == "" {
		s.ID = "__test__"
	}
	mgr := sshx.NewManager()
	defer mgr.CloseAll()
	client := docker.NewClient(mgr, s)
	info, err := client.Info(context.Background())
	if err != nil {
		return "", err
	}
	role := "worker"
	if info.Swarm.ControlAvailable {
		role = "manager"
	}
	return fmt.Sprintf("Docker %s · swarm %s · %s node · %d CPUs · %.1f GB RAM",
		info.ServerVersion, info.Swarm.LocalNodeState, role, info.NCPU,
		float64(info.MemTotal)/(1<<30)), nil
}

// ---- dashboard ----

// GetOverview aggregates swarm status and object counts for the dashboard.
func (a *App) GetOverview() (*docker.Overview, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	ov, err := c.Overview(a.ctxOrBg())
	if ov != nil {
		if srv, ok := a.store.Get(a.store.Active()); ok {
			ov.ServerID = srv.ID
			ov.ServerName = srv.Name
			ov.ServerHost = fmt.Sprintf("%s@%s:%d", srv.User, srv.Host, srv.Port)
		}
	}
	return ov, err
}

// ---- resources ----

func (a *App) ListNodes() ([]docker.NodeSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.Nodes(a.ctxOrBg())
}

func (a *App) ListServices() ([]docker.ServiceSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.Services(a.ctxOrBg())
}

func (a *App) ListServiceTasks(id string) ([]docker.TaskSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.ServiceTasks(a.ctxOrBg(), id)
}

func (a *App) ListStacks() ([]docker.StackSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.Stacks(a.ctxOrBg())
}

func (a *App) ListStackServices(name string) ([]docker.ServiceSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.StackServices(a.ctxOrBg(), name)
}

func (a *App) ListStackTasks(name string) ([]docker.TaskSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.StackTasks(a.ctxOrBg(), name)
}

func (a *App) ListContainers(all bool) ([]docker.ContainerSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.Containers(a.ctxOrBg(), all)
}

func (a *App) ListNetworks() ([]docker.NetworkSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.Networks(a.ctxOrBg())
}

func (a *App) ListVolumes() ([]docker.VolumeSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.Volumes(a.ctxOrBg())
}

func (a *App) ListSecrets() ([]docker.SecretSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.Secrets(a.ctxOrBg())
}

func (a *App) ListConfigs() ([]docker.ConfigSummary, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.Configs(a.ctxOrBg())
}

// Inspect returns the raw inspect JSON for node/service/container/network/
// volume/secret/config.
func (a *App) Inspect(kind, id string) (string, error) {
	c, err := a.activeClient()
	if err != nil {
		return "", err
	}
	return c.Inspect(a.ctxOrBg(), kind, id)
}

// ---- logs ----

func (a *App) GetServiceLogs(id string, tail int) (string, error) {
	c, err := a.activeClient()
	if err != nil {
		return "", err
	}
	return c.ServiceLogs(a.ctxOrBg(), id, tail)
}

func (a *App) GetContainerLogs(id string, tail int) (string, error) {
	c, err := a.activeClient()
	if err != nil {
		return "", err
	}
	return c.ContainerLogs(a.ctxOrBg(), id, tail)
}

// StartLogStream begins following logs for kind ("service"|"container") and
// emits docker.LogLine values on the Wails event "logs:<kind>:<id>".
// "logs:<kind>:<id>:end" fires when the stream stops.
func (a *App) StartLogStream(kind, id string, tail int) error {
	c, err := a.activeClient()
	if err != nil {
		return err
	}
	if err := docker.ValidID(id); err != nil {
		return err
	}
	if kind != "service" && kind != "container" {
		return errors.New("kind must be service or container")
	}
	if tail <= 0 {
		tail = 200
	}
	key := kind + ":" + id

	a.streamMu.Lock()
	if _, running := a.streams[key]; running {
		a.streamMu.Unlock()
		return nil
	}
	ctx, cancel := context.WithCancel(a.ctxOrBg())
	a.streams[key] = cancel
	a.streamMu.Unlock()

	go func() {
		defer func() {
			a.streamMu.Lock()
			delete(a.streams, key)
			a.streamMu.Unlock()
			wailsruntime.EventsEmit(a.ctxOrBg(), "logs:"+key+":end", true)
		}()
		onLine := func(isErr bool, line string) {
			stream := "stdout"
			if isErr {
				stream = "stderr"
			}
			wailsruntime.EventsEmit(a.ctxOrBg(), "logs:"+key, docker.LogLine{Stream: stream, Line: line})
		}
		if kind == "service" {
			_ = c.StreamServiceLogs(ctx, id, tail, onLine)
		} else {
			_ = c.StreamContainerLogs(ctx, id, tail, onLine)
		}
	}()
	return nil
}

// StopLogStream cancels a running log stream.
func (a *App) StopLogStream(kind, id string) {
	key := kind + ":" + id
	a.streamMu.Lock()
	if cancel, ok := a.streams[key]; ok {
		cancel()
		delete(a.streams, key)
	}
	a.streamMu.Unlock()
}

// ---- metrics ----

// GetStats returns one-shot per-container resource usage of the active host.
func (a *App) GetStats() ([]docker.StatsEntry, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.Stats(a.ctxOrBg())
}

// GetHostMetrics returns CPU/memory/disk/load of the active host.
func (a *App) GetHostMetrics() (*docker.HostMetrics, error) {
	c, err := a.activeClient()
	if err != nil {
		return nil, err
	}
	return c.HostMetrics(a.ctxOrBg())
}

// ---- actions ----

func (a *App) ScaleService(id string, replicas int) error {
	c, err := a.activeClient()
	if err != nil {
		return err
	}
	return c.ScaleService(a.ctxOrBg(), id, replicas)
}

func (a *App) RemoveService(id string) error {
	c, err := a.activeClient()
	if err != nil {
		return err
	}
	return c.RemoveService(a.ctxOrBg(), id)
}

// RestartService forces a rolling restart of every task of a service.
func (a *App) RestartService(id string) error {
	c, err := a.activeClient()
	if err != nil {
		return err
	}
	return c.ForceUpdateService(a.ctxOrBg(), id)
}

func (a *App) RemoveStack(name string) error {
	c, err := a.activeClient()
	if err != nil {
		return err
	}
	return c.RemoveStack(a.ctxOrBg(), name)
}

func (a *App) RemoveContainer(id string, force bool) error {
	c, err := a.activeClient()
	if err != nil {
		return err
	}
	return c.RemoveContainer(a.ctxOrBg(), id, force)
}

func (a *App) RemoveNode(id string, force bool) error {
	c, err := a.activeClient()
	if err != nil {
		return err
	}
	return c.RemoveNode(a.ctxOrBg(), id, force)
}

// SetNodeAvailability sets a node to active, pause or drain.
func (a *App) SetNodeAvailability(id, availability string) error {
	c, err := a.activeClient()
	if err != nil {
		return err
	}
	return c.SetNodeAvailability(a.ctxOrBg(), id, availability)
}
