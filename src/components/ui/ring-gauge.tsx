/**
 * Circular progress ring used across every dashboard's hero card (Scout
 * pool average, Coach roster size, Academy enrollment, Association active
 * cycles, Player AthlasX score). `value` and `max` set the fill fraction —
 * callers pass real numbers, this component has no data logic of its own.
 */
export function RingGauge({
  value,
  max,
  size = 88,
  strokeWidth = 8,
  label,
  sublabel,
}: {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  label: string | number
  sublabel?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const offset = circumference * (1 - fraction)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(245,245,240,0.08)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FF8A1E"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-anton text-ax-text leading-none tabular-nums" style={{ fontSize: size * 0.28 }}>{label}</span>
        {sublabel && (
          <span className="font-barlow-semi font-bold uppercase tracking-[0.1em] text-ax-textFaint" style={{ fontSize: size * 0.09, marginTop: 2 }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}
