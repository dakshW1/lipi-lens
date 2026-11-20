import { motion } from 'motion/react'
import { EASE } from '../lib/motion'

interface Props {
  src: string
  boxes: ([number, number, number, number] | null)[]
  active: number | null
  onHover: (i: number | null) => void
}

/** Photo with the detected text regions drawn on top (bbox values are 0–1 fractions). */
export function ImageWithBoxes({ src, boxes, active, onHover }: Props) {
  return (
    <div className="flex justify-center overflow-hidden rounded-[24px] bg-night">
      {/* The overlay wrapper hugs the rendered image, so % boxes line up exactly. */}
      <div className="relative">
        <img src={src} alt="Your photo" className="block max-h-[62vh] max-w-full" />
        {/* Dim everything except the hovered line */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-black"
          animate={{ opacity: active !== null ? 0.45 : 0 }}
          transition={{ duration: 0.3 }}
        />
        {boxes.map((b, i) =>
          b ? (
            <motion.button
              key={i}
              type="button"
              aria-label={`Text line ${i + 1}`}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(i)}
              onBlur={() => onHover(null)}
              initial={{ opacity: 0, scale: 1.15 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.25 + i * 0.12 }}
              className="absolute cursor-pointer rounded-lg"
              style={{
                left: `${b[0] * 100}%`,
                top: `${b[1] * 100}%`,
                width: `${(b[2] - b[0]) * 100}%`,
                height: `${(b[3] - b[1]) * 100}%`,
                boxShadow:
                  active === i
                    ? '0 0 0 2px var(--glow-gold), 0 0 0 9999px rgba(0,0,0,0), 0 0 30px rgba(242,193,78,0.5)'
                    : '0 0 0 2px rgba(242,193,78,0.75)',
                background: active === i ? 'rgba(242,193,78,0.12)' : 'transparent',
                zIndex: active === i ? 2 : 1,
              }}
            >
              <span className="num absolute -left-2.5 -top-2.5 grid h-6 w-6 place-items-center rounded-full bg-glow-gold text-[11px] font-extrabold text-night">
                {i + 1}
              </span>
            </motion.button>
          ) : null,
        )}
      </div>
    </div>
  )
}
