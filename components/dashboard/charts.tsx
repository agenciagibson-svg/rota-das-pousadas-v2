'use client'

import { motion } from 'motion/react'

/**
 * Gráficos leves (SVG/CSS) do painel.
 *
 * As animações usam `animate`, nunca `whileInView`: uma barra começa com
 * altura 0, e elemento de altura 0 nunca "entra na tela" para o
 * IntersectionObserver — o gráfico ficava vazio para sempre.
 */

export function AreaChart({
  data,
  labels,
  color = 'var(--primary)',
  format,
}: {
  data: number[]
  /** Rótulo de cada ponto (ex.: meses), mostrado embaixo do gráfico. */
  labels?: string[]
  color?: string
  /** Formata o valor no tooltip de cada ponto. */
  format?: (value: number) => string
}) {
  if (data.length === 0) return null
  const max = Math.max(...data, 0)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 100
  const h = 40
  const step = data.length > 1 ? w / (data.length - 1) : 0
  const pts = data.map((d, i) => {
    const x = data.length > 1 ? i * step : w / 2
    const y = h - ((d - min) / range) * (h - 6) - 3
    return [x, y] as const
  })
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(' ')
  const area = `${line} L ${pts[pts.length - 1]![0].toFixed(2)} ${h} L ${pts[0]![0].toFixed(2)} ${h} Z`
  const id = `grad-${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <path d={area} fill={`url(#${id})`} />
            {/* Sem animação de pathLength: com vector-effect a linha saía tracejada. */}
            <path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </motion.g>
        </svg>
        {/* Pontos em HTML para não deformarem com o preserveAspectRatio. */}
        {pts.map(([x, y], i) => (
          <span
            key={i}
            title={`${labels?.[i] ? `${labels[i]}: ` : ''}${format ? format(data[i]!) : data[i]}`}
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
            style={{ left: `${x}%`, top: `${(y / h) * 100}%`, borderColor: color }}
          />
        ))}
      </div>
      {labels && labels.length === data.length && (
        <div className="text-muted-foreground mt-2 flex justify-between text-[10px] font-medium">
          {labels.map((label, i) => (
            <span key={i} className="w-0 flex-1 text-center first:text-left last:text-right">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function BarChart({
  data,
  labels,
  color = 'var(--primary)',
  showValues = true,
}: {
  data: number[]
  labels: string[]
  color?: string
  /** Mostra o número em cima de cada barra com valor. */
  showValues?: boolean
}) {
  const max = Math.max(...data, 0) || 1
  return (
    <div className="flex h-full items-end justify-between gap-2">
      {data.map((d, i) => {
        // Valor pequeno ainda aparece: pelo menos 4% da altura.
        const pct = d > 0 ? Math.max(4, (d / max) * 100) : 0
        return (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className="relative flex w-full flex-1 flex-col items-center justify-end"
              title={`${labels[i] ?? ''}: ${d}`}
            >
              {showValues && d > 0 && (
                <span className="text-foreground mb-1 text-[10px] font-semibold">{d}</span>
              )}
              <motion.div
                className="w-full rounded-t-md"
                style={{ backgroundColor: color }}
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-muted-foreground truncate text-[10px] font-medium">
              {labels[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function Donut({ value, color = 'var(--primary)' }: { value: number; color?: string }) {
  const r = 42
  const c = 2 * Math.PI * r
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return (
    <div className="relative size-32">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (safe / 100) * c }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-foreground text-2xl font-semibold">{safe}%</span>
        <span className="text-muted-foreground text-[11px]">ocupação</span>
      </div>
    </div>
  )
}
