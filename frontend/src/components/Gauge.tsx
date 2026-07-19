import React from 'react'

interface GaugeProps {
  value: number // 0..100
  label: string
  sub?: string
  size?: number
  color?: string
}

export function Gauge({ value, label, sub, size = 92, color = '#38bdf8' }: GaugeProps) {
  const r = 38
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const hue = pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : color
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#232a35" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={hue} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
        />
        <text x="50" y="47" textAnchor="middle" fill="#d7dee8" fontSize="19" fontWeight="600">
          {pct.toFixed(0)}
          <tspan fontSize="11" fill="#8a94a3">%</tspan>
        </text>
        <text x="50" y="63" textAnchor="middle" fill="#8a94a3" fontSize="9.5">{label}</text>
      </svg>
      {sub && <div className="text-[10px] text-dim -mt-0.5">{sub}</div>}
    </div>
  )
}

interface SparklineProps {
  points: number[]
  color?: string
  width?: number
  height?: number
  max?: number
}

export function Sparkline({ points, color = '#38bdf8', width = 200, height = 40, max }: SparklineProps) {
  if (points.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-[10px] text-dim">collecting…</div>
  }
  const peak = max ?? Math.max(1, ...points)
  const step = width / (points.length - 1)
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(height - (p / peak) * (height - 3) - 1).toFixed(1)}`)
  return (
    <svg width={width} height={height} className="block">
      <polygon points={`0,${height} ${coords.join(' ')} ${width},${height}`} fill={color} opacity={0.12} />
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}
