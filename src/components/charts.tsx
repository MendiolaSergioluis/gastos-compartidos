import type { ReactNode } from 'react'

export interface Slice {
  label: string
  value: number
  color: string
}

export function Donut({
  slices,
  size = 170,
  thickness = 20,
  center,
}: {
  slices: Slice[]
  size?: number
  thickness?: number
  center?: ReactNode
}) {
  const total = slices.reduce((acc, slice) => acc + Math.max(0, slice.value), 0)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-hidden="true">
        <circle
          className="donut__track"
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth={thickness / (size / 100)}
        />
        {total > 0 &&
          slices.map((slice) => {
            const length = (Math.max(0, slice.value) / total) * circumference
            const element = (
              <circle
                key={slice.label}
                className="donut__slice"
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness / (size / 100)}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
              />
            )
            offset += length
            return element
          })}
      </svg>
      {center && <div className="donut__center">{center}</div>}
    </div>
  )
}

export function SplitBar({
  segments,
  height = 12,
}: {
  segments: { value: number; color: string; label?: string }[]
  height?: number
}) {
  const total = segments.reduce((acc, segment) => acc + Math.max(0, segment.value), 0)
  return (
    <div className="splitbar" style={{ height }}>
      {total > 0 &&
        segments.map((segment, index) => (
          <span
            key={`${segment.label ?? 'part'}-${index}`}
            className="splitbar__part"
            title={segment.label}
            style={{
              width: `${(Math.max(0, segment.value) / total) * 100}%`,
              background: segment.color,
            }}
          />
        ))}
    </div>
  )
}

export interface BarPoint {
  label: string
  value: number
  hint?: string
  color?: string
  highlight?: boolean
}

export function Bars({
  points,
  max,
  renderValue,
  height = 130,
}: {
  points: BarPoint[]
  max?: number
  renderValue?: (point: BarPoint) => string
  height?: number
}) {
  const top = max ?? Math.max(...points.map((point) => point.value), 0)
  return (
    // sin alto fijo: el contenedor crece con las etiquetas, así no se recortan
    <div className="bars" data-points={points.length}>
      {points.map((point) => {
        const ratio = top > 0 ? Math.min(1, point.value / top) : 0
        return (
          <div className="bars__column" key={point.label}>
            <span className="bars__value">
              {renderValue ? renderValue(point) : `${Math.round(point.value)}`}
            </span>
            <div className="bars__track" style={{ height }}>
              <div
                className={`bars__fill ${point.highlight ? 'bars__fill--highlight' : ''}`}
                style={{ height: `${ratio * 100}%`, background: point.color }}
                title={point.hint ?? point.label}
              />
            </div>
            <span className="bars__label">{point.label}</span>
          </div>
        )
      })}
    </div>
  )
}
