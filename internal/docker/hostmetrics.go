package docker

import (
	"context"
	"strconv"
	"strings"
	"time"
)

// HostMetrics is a point-in-time snapshot of the connected host, collected
// from /proc, free and df over a single SSH session.
type HostMetrics struct {
	CPUPercent    float64 `json:"cpuPercent"`
	Load1         float64 `json:"load1"`
	Load5         float64 `json:"load5"`
	Load15        float64 `json:"load15"`
	MemTotal      uint64  `json:"memTotal"`
	MemUsed       uint64  `json:"memUsed"`
	MemAvailable  uint64  `json:"memAvailable"`
	DiskTotal     uint64  `json:"diskTotal"`
	DiskUsed      uint64  `json:"diskUsed"`
	DiskAvailable uint64  `json:"diskAvailable"`
	UptimeSeconds float64 `json:"uptimeSeconds"`
	CollectedAt   string  `json:"collectedAt"`
}

// hostScript runs under `sh -s` (fed over stdin to avoid quoting issues).
// It samples /proc/stat twice one second apart so the CPU percentage is a
// real measurement, not a since-boot average.
const hostScript = `read cpu u n s i io irq si st rest < /proc/stat
sleep 1
read cpu u2 n2 s2 i2 io2 irq2 si2 st2 rest2 < /proc/stat
echo "CPU $u $n $s $i $io $irq $si $st $u2 $n2 $s2 $i2 $io2 $irq2 $si2 $st2"
free -b | awk '/^Mem:/ {print "MEM", $2, $3, $7}'
df -B1 -P / | awk 'NR==2 {print "DISK", $2, $3, $4}'
awk '{print "LOAD", $1, $2, $3}' /proc/loadavg
awk '{print "UPTIME", $1}' /proc/uptime
`

// HostMetrics collects utilization metrics from the connected host.
func (c *Client) HostMetrics(ctx context.Context) (*HostMetrics, error) {
	out, err := c.runStdin(ctx, "sh -s", hostScript)
	if err != nil {
		return nil, err
	}
	m := &HostMetrics{CollectedAt: time.Now().UTC().Format(time.RFC3339)}
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) == 0 {
			continue
		}
		switch f[0] {
		case "CPU":
			if len(f) < 17 {
				continue
			}
			nums := make([]float64, 16)
			ok := true
			for i := 0; i < 16; i++ {
				v, err := strconv.ParseFloat(f[i+1], 64)
				if err != nil {
					ok = false
					break
				}
				nums[i] = v
			}
			if !ok {
				continue
			}
			var total1, total2 float64
			for i := 0; i < 8; i++ {
				total1 += nums[i]
				total2 += nums[i+8]
			}
			idle1 := nums[3] + nums[4]
			idle2 := nums[11] + nums[12]
			if d := total2 - total1; d > 0 {
				m.CPUPercent = (1 - (idle2-idle1)/d) * 100
			}
		case "MEM":
			if len(f) < 4 {
				continue
			}
			m.MemTotal = atoiU(f[1])
			m.MemUsed = atoiU(f[2])
			m.MemAvailable = atoiU(f[3])
		case "DISK":
			if len(f) < 4 {
				continue
			}
			m.DiskTotal = atoiU(f[1])
			m.DiskUsed = atoiU(f[2])
			m.DiskAvailable = atoiU(f[3])
		case "LOAD":
			if len(f) < 4 {
				continue
			}
			m.Load1 = atoiF(f[1])
			m.Load5 = atoiF(f[2])
			m.Load15 = atoiF(f[3])
		case "UPTIME":
			if len(f) < 2 {
				continue
			}
			m.UptimeSeconds = atoiF(f[1])
		}
	}
	return m, nil
}

func atoiU(s string) uint64 {
	v, _ := strconv.ParseUint(s, 10, 64)
	return v
}

func atoiF(s string) float64 {
	v, _ := strconv.ParseFloat(s, 64)
	return v
}
