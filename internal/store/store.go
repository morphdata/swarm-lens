// Package store persists the configured servers and the active context
// to a JSON file in the user's config directory.
package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

// AuthType describes how to authenticate against a server's SSH daemon.
type AuthType string

const (
	AuthPassword AuthType = "password"
	AuthKey      AuthType = "key"
	AuthAgent    AuthType = "agent"
)

// Server is a single SSH target running a Docker daemon (ideally a swarm manager).
type Server struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Host          string   `json:"host"`
	Port          int      `json:"port"`
	User          string   `json:"user"`
	Auth          AuthType `json:"auth"`
	Password      string   `json:"password,omitempty"`
	KeyPath       string   `json:"keyPath,omitempty"`
	KeyPassphrase string   `json:"keyPassphrase,omitempty"`
	StrictHostKey bool     `json:"strictHostKey,omitempty"`
}

type fileData struct {
	Servers       []Server `json:"servers"`
	ActiveContext string   `json:"activeContext"`
}

// Store is a concurrency-safe JSON-backed server registry.
type Store struct {
	path string
	mu   sync.Mutex
	data fileData
}

// DefaultPath returns ~/.config/swarm-lens/servers.json on Linux and
// ~/Library/Application Support/swarm-lens/servers.json on macOS.
func DefaultPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "swarm-lens", "servers.json"), nil
}

// New returns an empty store bound to path.
func New(path string) *Store {
	return &Store{path: path}
}

// Load reads the store from path. A missing file yields an empty store.
func Load(path string) (*Store, error) {
	s := &Store{path: path}
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 {
		return s, nil
	}
	if err := json.Unmarshal(raw, &s.data); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) saveLocked() error {
	if s.path == "" {
		return errors.New("store path not set")
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(&s.data, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// List returns a copy of all configured servers.
func (s *Store) List() []Server {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Server, len(s.data.Servers))
	copy(out, s.data.Servers)
	return out
}

// Get returns the server with the given id.
func (s *Store) Get(id string) (Server, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, srv := range s.data.Servers {
		if srv.ID == id {
			return srv, true
		}
	}
	return Server{}, false
}

// Upsert adds a new server (assigning an id) or replaces an existing one.
func (s *Store) Upsert(srv Server) (Server, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if srv.Port == 0 {
		srv.Port = 22
	}
	if srv.ID == "" {
		srv.ID = newID()
		s.data.Servers = append(s.data.Servers, srv)
	} else {
		found := false
		for i := range s.data.Servers {
			if s.data.Servers[i].ID == srv.ID {
				s.data.Servers[i] = srv
				found = true
				break
			}
		}
		if !found {
			s.data.Servers = append(s.data.Servers, srv)
		}
	}
	if s.data.ActiveContext == "" {
		s.data.ActiveContext = srv.ID
	}
	return srv, s.saveLocked()
}

// Remove deletes a server and fixes up the active context.
func (s *Store) Remove(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := make([]Server, 0, len(s.data.Servers))
	for _, srv := range s.data.Servers {
		if srv.ID != id {
			next = append(next, srv)
		}
	}
	s.data.Servers = next
	if s.data.ActiveContext == id {
		s.data.ActiveContext = ""
		if len(next) > 0 {
			s.data.ActiveContext = next[0].ID
		}
	}
	return s.saveLocked()
}

// Active returns the id of the active context ("" when unset).
func (s *Store) Active() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data.ActiveContext
}

// SetActive changes the active context.
func (s *Store) SetActive(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, srv := range s.data.Servers {
		if srv.ID == id {
			s.data.ActiveContext = id
			return s.saveLocked()
		}
	}
	return errors.New("server not found")
}
