import { animate, motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Shared easing across Kilometre / Clausewise / Lipi Lens: fast out, long settle. */
export const EASE = [0.16, 1, 0.3, 1] as const

/** Fade + rise + un-blur when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  y = 28,
}: {
  children: ReactNode
  delay?: number
  className?: string
  y?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

/** Headline that rises in word by word, like a title sequence. */
export function Words({
  text,
  className,
  delay = 0,
  stagger = 0.06,
  immediate = false,
}: {
  text: string
  className?: string
  delay?: number
  stagger?: number
  /** Animate on mount (above-the-fold headlines) instead of waiting to scroll into view. */
  immediate?: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.3 })
  const inView = immediate || seen
  const words = text.split(' ')
  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.1em] align-bottom" aria-hidden="true">
          <motion.span
            className="inline-block"
            initial={{ y: '110%', rotate: 4 }}
            animate={inView ? { y: '0%', rotate: 0 } : undefined}
            transition={{ duration: 0.85, ease: EASE, delay: delay + i * stagger }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

/** Number that counts up when it scrolls into view. */
export function CountTo({
  to,
  from = 0,
  decimals = 0,
  suffix = '',
  className,
  duration = 1.4,
  delay = 0.15,
}: {
  to: number
  from?: number
  decimals?: number
  suffix?: string
  className?: string
  duration?: number
  delay?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const reduce = useReducedMotion()
  const [value, setValue] = useState(reduce ? to : from)
  useEffect(() => {
    if (!inView) return
    if (reduce) return setValue(to)
    const controls = animate(from, to, { duration, delay, ease: EASE, onUpdate: setValue })
    // Settle exactly, even if animation frames are throttled (background tab).
    const settle = setTimeout(() => setValue(to), (delay + duration) * 1000 + 150)
    return () => {
      controls.stop()
      clearTimeout(settle)
    }
  }, [inView, from, to, duration, delay, reduce])
  return (
    <span ref={ref} className={className}>
      {value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}

/** Progress ring that draws itself. `progress` is 0–1. */
export function Ring({
  progress,
  size = 150,
  stroke = 14,
  color = 'var(--glow-gold)',
  track = 'rgba(255,255,255,0.1)',
  label,
  children,
}: {
  progress: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  label: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - p) }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

/** Container that staggers its motion children in. */
export const stagger = {
  parent: { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } },
  child: {
    hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
  },
}
