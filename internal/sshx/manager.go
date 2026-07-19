// Package sshx manages pooled SSH connections to the configured servers and
// runs remote commands (one-shot and streaming) over them.
package sshx

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
	"golang.org/x/crypto/ssh/knownhosts"

	"swarmlens/internal/store"
)

// Manager keeps one SSH connection per server and recovers stale ones.
type Manager struct {
	mu      sync.Mutex
	clients map[string]*ssh.Client
}

// NewManager returns an empty connection pool.
func NewManager() *Manager {
	return &Manager{clients: make(map[string]*ssh.Client)}
}

func (m *Manager) clientFor(srv store.Server) (*ssh.Client, error) {
	m.mu.Lock()
	if c, ok := m.clients[srv.ID]; ok {
		m.mu.Unlock()
		if _, _, err := c.SendRequest("keepalive@swarmlens", true, nil); err == nil {
			return c, nil
		}
		m.evict(srv.ID)
	} else {
		m.mu.Unlock()
	}

	cfg, err := clientConfig(srv)
	if err != nil {
		return nil, err
	}
	addr := net.JoinHostPort(srv.Host, fmt.Sprintf("%d", srv.Port))
	d := net.Dialer{Timeout: 10 * time.Second}
	conn, err := d.Dial("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", addr, err)
	}
	c, chans, reqs, err := ssh.NewClientConn(conn, addr, cfg)
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("ssh handshake with %s: %w", addr, err)
	}
	client := ssh.NewClient(c, chans, reqs)

	m.mu.Lock()
	if existing, ok := m.clients[srv.ID]; ok {
		m.mu.Unlock()
		_ = client.Close()
		return existing, nil
	}
	m.clients[srv.ID] = client
	m.mu.Unlock()
	return client, nil
}

func clientConfig(srv store.Server) (*ssh.ClientConfig, error) {
	var auths []ssh.AuthMethod
	switch srv.Auth {
	case store.AuthPassword:
		auths = append(auths,
			ssh.Password(srv.Password),
			ssh.KeyboardInteractive(func(user, instruction string, questions []string, echos []bool) ([]string, error) {
				answers := make([]string, len(questions))
				for i := range answers {
					answers[i] = srv.Password
				}
				return answers, nil
			}),
		)
	case store.AuthKey:
		raw, err := os.ReadFile(expandHome(srv.KeyPath))
		if err != nil {
			return nil, fmt.Errorf("read private key %s: %w", srv.KeyPath, err)
		}
		var signer ssh.Signer
		if srv.KeyPassphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(raw, []byte(srv.KeyPassphrase))
		} else {
			signer, err = ssh.ParsePrivateKey(raw)
		}
		if err != nil {
			return nil, fmt.Errorf("parse private key: %w", err)
		}
		auths = append(auths, ssh.PublicKeys(signer))
	case store.AuthAgent:
		sock := os.Getenv("SSH_AUTH_SOCK")
		if sock == "" {
			return nil, errors.New("SSH_AUTH_SOCK is not set; ssh-agent is not available")
		}
		conn, err := net.Dial("unix", sock)
		if err != nil {
			return nil, fmt.Errorf("connect to ssh-agent: %w", err)
		}
		auths = append(auths, ssh.PublicKeysCallback(agent.NewClient(conn).Signers))
	default:
		return nil, fmt.Errorf("unknown auth type %q", srv.Auth)
	}

	var hostKeyCB ssh.HostKeyCallback
	if srv.StrictHostKey {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		cb, err := knownhosts.New(filepath.Join(home, ".ssh", "known_hosts"))
		if err != nil {
			return nil, fmt.Errorf("load known_hosts: %w", err)
		}
		hostKeyCB = cb
	} else {
		//nolint:gosec // TOFU is left to the user; strict mode available per server.
		hostKeyCB = ssh.InsecureIgnoreHostKey()
	}

	return &ssh.ClientConfig{
		User:            srv.User,
		Auth:            auths,
		HostKeyCallback: hostKeyCB,
		Timeout:         12 * time.Second,
	}, nil
}

func expandHome(p string) string {
	if strings.HasPrefix(p, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, p[2:])
		}
	}
	return p
}

// Run executes a command and returns stdout and stderr. Empty stdin is
// skipped; non-empty stdin is piped to the command.
func (m *Manager) Run(ctx context.Context, srv store.Server, command, stdin string, timeout time.Duration) (string, string, error) {
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}
	client, err := m.clientFor(srv)
	if err != nil {
		return "", "", err
	}
	session, err := client.NewSession()
	if err != nil {
		m.evict(srv.ID)
		return "", "", fmt.Errorf("open ssh session: %w", err)
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr
	if stdin != "" {
		session.Stdin = strings.NewReader(stdin)
	}

	done := make(chan error, 1)
	go func() { done <- session.Run(command) }()

	select {
	case runErr := <-done:
		if runErr != nil {
			var exitErr *ssh.ExitError
			if errors.As(runErr, &exitErr) {
				msg := strings.TrimSpace(stderr.String())
				if msg == "" {
					msg = runErr.Error()
				}
				return stdout.String(), stderr.String(), errors.New(msg)
			}
			return stdout.String(), stderr.String(), runErr
		}
		return stdout.String(), stderr.String(), nil
	case <-ctx.Done():
		_ = session.Close()
		return stdout.String(), stderr.String(), ctx.Err()
	}
}

// RunStream executes a long-running command and invokes onLine for every
// stdout/stderr line until the command exits or ctx is cancelled.
func (m *Manager) RunStream(ctx context.Context, srv store.Server, command string, onLine func(isErr bool, line string)) error {
	client, err := m.clientFor(srv)
	if err != nil {
		return err
	}
	session, err := client.NewSession()
	if err != nil {
		m.evict(srv.ID)
		return fmt.Errorf("open ssh session: %w", err)
	}
	defer session.Close()

	outPipe, err := session.StdoutPipe()
	if err != nil {
		return err
	}
	errPipe, err := session.StderrPipe()
	if err != nil {
		return err
	}
	if err := session.Start(command); err != nil {
		return err
	}

	var wg sync.WaitGroup
	scan := func(r io.Reader, isErr bool) {
		defer wg.Done()
		sc := bufio.NewScanner(r)
		sc.Buffer(make([]byte, 0, 256*1024), 1024*1024)
		for sc.Scan() {
			onLine(isErr, sc.Text())
		}
	}
	wg.Add(2)
	go scan(outPipe, false)
	go scan(errPipe, true)

	waitDone := make(chan error, 1)
	go func() {
		waitErr := session.Wait()
		wg.Wait()
		waitDone <- waitErr
	}()

	select {
	case waitErr := <-waitDone:
		if waitErr != nil && ctx.Err() == nil {
			var exitErr *ssh.ExitError
			if errors.As(waitErr, &exitErr) && exitErr.ExitStatus() == 0 {
				return nil
			}
			return waitErr
		}
		return nil
	case <-ctx.Done():
		_ = session.Close()
		return ctx.Err()
	}
}

// Disconnect drops the pooled connection for a server.
func (m *Manager) Disconnect(id string) { m.evict(id) }

func (m *Manager) evict(id string) {
	m.mu.Lock()
	c, ok := m.clients[id]
	delete(m.clients, id)
	m.mu.Unlock()
	if ok {
		_ = c.Close()
	}
}

// CloseAll drops every pooled connection.
func (m *Manager) CloseAll() {
	m.mu.Lock()
	clients := m.clients
	m.clients = make(map[string]*ssh.Client)
	m.mu.Unlock()
	for _, c := range clients {
		_ = c.Close()
	}
}
