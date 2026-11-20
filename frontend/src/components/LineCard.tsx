import { useState } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, Check, Copy, Volume2 } from 'lucide-react'
import clsx from 'clsx'
import { speakKannada, type Line } from '../api'
import { stagger } from '../lib/motion'

interface Props {
  line: Line
  index: number
  active: boolean
  onHover: (i: number | null) => void
}

export function LineCard({ line, index, active, onHover }: Props) {
  const [copied, setCopied] = useState(false)
  const [noVoice, setNoVoice] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const low = line.confidence < 0.6
  const pct = Math.round(line.confidence * 100)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${line.kannada}\n${line.transliteration}\n${line.translation}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked */
    }
  }

  const speak = () => {
    setNoVoice(!speakKannada(line.kannada))
    setSpeaking(true)
    setTimeout(() => setSpeaking(false), 1600)
  }

  return (
    <motion.article
      variants={stagger.child}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      className={clsx(
        'group relative rounded-[24px] bg-surface p-5 transition-[box-shadow,transform] duration-300 sm:p-6',
        active ? 'shadow-lift -translate-y-0.5 ring-2 ring-turmeric/70' : 'shadow-[0_1px_2px_rgba(20,20,20,0.05)]',
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={clsx(
            'num mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold transition-colors',
            active ? 'bg-turmeric text-night' : 'bg-turmeric-soft text-turmeric-ink',
          )}
        >
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <p lang="kn" className="kn break-words text-[28px] font-bold leading-[1.35] tracking-tight sm:text-[32px]">
            {line.kannada}
          </p>
          <p className="mt-1 break-words text-[15px] font-bold tracking-wide text-turmeric-ink" title="ISO 15919 transliteration">
            {line.transliteration}
            {line.romanized !== line.transliteration && (
              <span className="ml-2 text-[13px] font-semibold text-muted">· say “{line.romanized}”</span>
            )}
          </p>
          <p className="mt-3 break-words font-serif text-[22px] italic leading-snug text-ink-2">{line.translation}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Meter value={line.confidence} />
            <span className="num text-xs font-bold text-muted">{pct}% sure</span>
            {low && (
              <span className="flex items-center gap-1 rounded-full bg-bad-soft px-2.5 py-1 text-[11px] font-extrabold text-bad">
                <AlertTriangle size={12} /> Check against the photo
              </span>
            )}
          </div>
          {noVoice && (
            <p className="mt-2 text-xs font-semibold text-muted">
              No Kannada voice on this device. Add one in your system's speech settings.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <IconButton label="Read aloud" onClick={speak}>
            <span className="relative">
              <Volume2 size={18} />
              {speaking && <span className="pulse-ring absolute -inset-1.5 rounded-full border-2 border-turmeric" />}
            </span>
          </IconButton>
          <IconButton label={copied ? 'Copied' : 'Copy'} onClick={copy}>
            {copied ? <Check size={18} className="text-ok" /> : <Copy size={18} />}
          </IconButton>
        </div>
      </div>
    </motion.article>
  )
}

/** Five-segment confidence meter: segments fill in sequence. */
function Meter({ value }: { value: number }) {
  const filled = Math.round(value * 5)
  const color = value >= 0.8 ? 'bg-ok' : value >= 0.6 ? 'bg-turmeric' : 'bg-bad'
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`Confidence ${Math.round(value * 100)}%`}>
      {Array.from({ length: 5 }, (_, i) => (
        <motion.span
          key={i}
          className={clsx('h-2 w-5 rounded-[3px]', i < filled ? color : 'bg-line')}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          style={{ originX: 0 }}
          transition={{ delay: 0.4 + i * 0.06, duration: 0.3 }}
        />
      ))}
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-paper hover:text-ink active:scale-90"
    >
      {children}
    </button>
  )
}
