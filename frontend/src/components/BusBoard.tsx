import { motion } from 'motion/react'
import { ArrowRight, Bus } from 'lucide-react'
import type { ReadResult } from '../api'
import { stagger } from '../lib/motion'

/** Bus boards get a route card that reads like the board itself. */
export function BusBoard({ data, lines }: { data: NonNullable<ReadResult['structured']>; lines: ReadResult['lines'] }) {
  const en = (kn: string) => lines.find((l) => l.kannada.includes(kn))?.translation?.replace(/^Via\s+/i, '')
  const stops = [...data.via, data.destination].filter(Boolean)

  return (
    <motion.section variants={stagger.child} className="grain rounded-[24px] bg-night p-5 text-night-text sm:p-6">
      <div className="relative z-[2]">
        <div className="eyebrow flex items-center gap-2 text-night-muted">
          <Bus size={14} className="text-glow-gold" /> Bus route
        </div>
        <div className="mt-4 flex items-center gap-5">
          {data.route_no && (
            <div className="num led rounded-2xl border border-night-line bg-black px-4 py-2 text-[44px] font-extrabold leading-none text-glow-gold">
              {data.route_no}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-night-muted">Going to</p>
            <p className="font-display text-[30px] font-extrabold leading-tight tracking-tight">
              {en(data.destination) || data.destination}
            </p>
            <p lang="kn" className="kn text-sm font-semibold text-night-muted">{data.destination}</p>
          </div>
        </div>

        {/* Route line: via stops then destination */}
        {stops.length > 1 && (
          <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3">
            {stops.map((s, i) => (
              <motion.li
                key={s + i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.12 }}
                className="flex items-center gap-2"
              >
                <span className="flex items-center gap-2 rounded-full border border-night-line bg-night-2 px-3 py-1.5">
                  <span className={`h-2 w-2 rounded-full ${i === stops.length - 1 ? 'bg-glow-gold' : 'bg-night-muted'}`} />
                  <span className="text-sm font-bold">{en(s) || s}</span>
                </span>
                {i < stops.length - 1 && <ArrowRight size={14} className="text-night-muted" />}
              </motion.li>
            ))}
          </ol>
        )}
      </div>
    </motion.section>
  )
}
