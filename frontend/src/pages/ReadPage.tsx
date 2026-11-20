import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ArrowLeft, Check, Copy, HeartHandshake, MousePointer2, RotateCcw, Timer } from 'lucide-react'
import { api, CATEGORY_LABELS, type ReadResult } from '../api'
import { useImagePicker } from '../components/ImagePicker'
import { Hero } from '../components/Hero'
import { ScanStage } from '../components/ScanStage'
import { ImageWithBoxes } from '../components/ImageWithBoxes'
import { LineCard } from '../components/LineCard'
import { BusBoard } from '../components/BusBoard'
import { CountTo, EASE, Ring, stagger } from '../lib/motion'
import { makeSampleBusBoard } from '../lib/sample'

const MIN_SCAN_MS = 2400
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Phase = 'idle' | 'scanning' | 'result' | 'error'

interface Props {
  onContribute: (file: File, result: ReadResult) => void
}

export function ReadPage({ onContribute }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ReadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const run = async (f: File) => {
    setFile(f)
    setResult(null)
    setError(null)
    setDone(false)
    setPhase('scanning')
    window.scrollTo({ top: 0 })
    try {
      const [r] = await Promise.all([api.read(f), wait(MIN_SCAN_MS)])
      setDone(true)
      await wait(650)
      setResult(r)
      setPhase('result')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  const picker = useImagePicker(run)
  const reset = () => {
    setPhase('idle')
    setFile(null)
    setResult(null)
  }

  return (
    <div {...picker.dropProps}>
      {picker.inputs}
      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div key="idle" exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}>
            <Hero
              onCamera={picker.openCamera}
              onUpload={picker.openUpload}
              onSample={async () => {
                setPreparing(true)
                try {
                  await run(await makeSampleBusBoard())
                } finally {
                  setPreparing(false)
                }
              }}
              preparing={preparing}
              dragging={picker.dragging}
            />
          </motion.div>
        )}

        {phase === 'scanning' && preview && (
          <motion.div key="scan">
            <ScanStage src={preview} done={done} />
          </motion.div>
        )}

        {phase === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-lg rounded-[24px] bg-surface p-8 text-center"
          >
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-bad-soft text-bad">
              <AlertTriangle size={26} />
            </span>
            <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight">Couldn't read that one</h2>
            <p className="mt-2 font-semibold text-muted">{error}</p>
            <div className="mt-6 flex justify-center gap-3">
              {file && (
                <button onClick={() => run(file)} className="btn bg-ink text-paper">
                  <RotateCcw size={16} /> Try again
                </button>
              )}
              <button onClick={reset} className="btn border border-line">
                New photo
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'result' && result && preview && file && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Results
              result={result}
              preview={preview}
              onReset={reset}
              onContribute={() => onContribute(file, result)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Results({
  result,
  preview,
  onReset,
  onContribute,
}: {
  result: ReadResult
  preview: string
  onReset: () => void
  onContribute: () => void
}) {
  const [active, setActive] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const lines = result.lines
  const avg = lines.length ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length : 0

  const headline = result.structured?.destination
    ? `${result.structured.route_no ? `Bus ${result.structured.route_no} to ` : 'To '}${
        lines.find((l) => l.kannada.includes(result.structured!.destination))?.translation ?? result.structured.destination
      }`
    : [...new Set(lines.filter((l) => /[ಀ-೿]/.test(l.kannada)).map((l) => l.translation.trim()))]
        .filter(Boolean)
        .slice(0, 3)
        .join(' · ')

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(
        lines.map((l) => `${l.kannada}\n${l.transliteration}\n${l.translation}`).join('\n\n'),
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onReset} className="btn h-10 bg-surface px-4 text-sm hover:bg-surface-2">
          <ArrowLeft size={16} /> New photo
        </button>
        <span className="rounded-full bg-turmeric-soft px-3 py-1.5 text-xs font-extrabold text-turmeric-ink">
          {CATEGORY_LABELS[result.category]}
        </span>
        <div className="flex-1" />
        {lines.length > 0 && (
          <button onClick={copyAll} className="btn h-10 px-4 text-sm text-muted hover:text-ink">
            {copied ? <Check size={16} className="text-ok" /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy all'}
          </button>
        )}
      </div>

      {result.demo && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-turmeric-soft px-4 py-3 text-sm font-bold text-turmeric-ink"
        >
          Demo mode: this is a sample reading, not your photo. Add a free GEMINI_API_KEY to backend/.env to read real
          signs.
        </motion.p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:col-span-5">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: EASE }}>
            <ImageWithBoxes src={preview} boxes={lines.map((l) => l.bbox)} active={active} onHover={setActive} />
          </motion.div>
          {lines.some((l) => l.bbox) && (
            <p className="flex items-center gap-1.5 px-1 text-xs font-bold text-muted">
              <MousePointer2 size={13} /> Hover a line or a box to match them up
            </p>
          )}
        </div>

        <motion.div
          variants={stagger.parent}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-4 lg:col-span-7"
        >
          {/* Summary: the answer first, then the numbers behind it */}
          <motion.section variants={stagger.child} className="grain rounded-[24px] bg-night p-6 text-night-text">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-glow-gold/20 blur-[70px]" />
            <div className="relative z-[2]">
              <span className="eyebrow text-night-muted">{lines.length ? 'It says' : 'Result'}</span>
              <p className="mt-2 font-serif text-[clamp(28px,3.6vw,42px)] italic leading-[1.1] text-night-text">
                {lines.length ? headline : 'No Kannada text found.'}
              </p>
              {lines.length === 0 && (
                <p className="mt-2 text-sm font-semibold text-night-muted">
                  Try getting closer to the sign, or cut down glare and blur.
                </p>
              )}
              {lines.length > 0 && (
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <Stat label="Lines found">
                    <CountTo to={lines.length} className="num text-[34px] font-extrabold leading-none" />
                  </Stat>
                  <Stat label="Avg. confidence">
                    <div className="flex items-center gap-2">
                      <Ring progress={avg} size={38} stroke={6} label={`Average confidence ${Math.round(avg * 100)}%`} />
                      <CountTo to={Math.round(avg * 100)} suffix="%" className="num text-[26px] font-extrabold leading-none" />
                    </div>
                  </Stat>
                  <Stat label={result.cached ? 'Time (cached)' : 'Time'}>
                    <span className="flex items-baseline gap-1">
                      <CountTo to={result.latency_ms / 1000} decimals={1} className="num text-[34px] font-extrabold leading-none" />
                      <span className="text-sm font-bold text-night-muted">s</span>
                      <Timer size={14} className="ml-1 self-center text-night-muted" />
                    </span>
                  </Stat>
                </div>
              )}
            </div>
          </motion.section>

          {result.structured && <BusBoard data={result.structured} lines={lines} />}

          {lines.map((line, i) => (
            <LineCard key={i} line={line} index={i} active={active === i} onHover={setActive} />
          ))}

          {lines.length > 0 && !result.demo && (
            <motion.button
              variants={stagger.child}
              onClick={onContribute}
              className="group flex cursor-pointer items-center gap-4 rounded-[24px] border-2 border-dashed border-line p-5 text-left transition hover:border-turmeric hover:bg-turmeric-soft"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-turmeric-soft text-turmeric-ink transition group-hover:bg-turmeric group-hover:text-night">
                <HeartHandshake size={22} />
              </span>
              <span className="flex-1">
                <span className="block font-extrabold">Add this photo to the open Kannada dataset</span>
                <span className="text-sm font-semibold text-muted">Takes 20 seconds. Faces and plates are blurred.</span>
              </span>
            </motion.button>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-3.5">
      <p className="mb-2 text-[11px] font-bold text-night-muted">{label}</p>
      {children}
    </div>
  )
}
