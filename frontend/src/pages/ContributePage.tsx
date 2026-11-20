import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, Check, ImageUp, LoaderCircle, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { api, CATEGORY_LABELS, type Category, type ReadResult } from '../api'
import { useImagePicker } from '../components/ImagePicker'
import { CountTo, EASE, Reveal, Words } from '../lib/motion'
import { storageGet, storageSet } from '../lib/theme'

const CONDITIONS = ['day', 'night', 'glare', 'angled', 'blurry', 'stylised font', 'faded', 'hand-painted']
const MIN_LONG_EDGE = 1280

export interface EditLine {
  kannada: string
  translation: string
  bbox: number[] | null
}

interface Props {
  initial: { file: File; result: ReadResult } | null
  onViewDataset: () => void
}

export function ContributePage({ initial, onViewDataset }: Props) {
  const [file, setFile] = useState<File | null>(initial?.file ?? null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [lines, setLines] = useState<EditLine[]>(initial ? toEdit(initial.result) : [])
  const [category, setCategory] = useState<Category>(initial?.result.category ?? 'shop_sign')
  const [location, setLocation] = useState(() => storageGet('lipi-location'))
  const [conditions, setConditions] = useState<string[]>([])
  const [contributor, setContributor] = useState(() => storageGet('lipi-contributor'))
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<'prefill' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ id: string; face: number; plate: number; total: number } | null>(null)

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    if (!preview) return
    const img = new Image()
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = preview
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const pick = (f: File) => {
    setFile(f)
    setSize(null)
    setLines([])
    setError(null)
    setConsent(false)
  }
  const picker = useImagePicker(pick)

  const tooSmall = size !== null && Math.max(size.w, size.h) < MIN_LONG_EDGE
  const hasText = lines.some((l) => l.kannada.trim())
  const steps = [
    { label: 'Photo', done: !!file && !tooSmall },
    { label: 'Text', done: hasText },
    { label: 'Details', done: !!location.trim() },
    { label: 'Consent', done: consent },
  ]
  const canSave = !!file && !tooSmall && hasText && consent && busy === null

  const prefill = async () => {
    if (!file) return
    setBusy('prefill')
    setError(null)
    try {
      const r = await api.read(file)
      setLines(toEdit(r))
      setCategory(r.category)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!file) return
    setBusy('save')
    setError(null)
    storageSet('lipi-contributor', contributor)
    storageSet('lipi-location', location)
    try {
      const r = await api.contribute({
        file,
        lines: lines.filter((l) => l.kannada.trim()),
        category,
        location,
        conditions,
        contributor,
        consent,
      })
      const s = await api.stats().catch(() => null)
      setSaved({ id: r.saved, ...r.blurred, total: s?.samples ?? 0 })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const update = (i: number, patch: Partial<EditLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  if (saved) {
    return (
      <Saved
        saved={saved}
        onAnother={() => {
          setFile(null)
          setSaved(null)
          setLines([])
          setConsent(false)
          setConditions([])
        }}
        onViewDataset={onViewDataset}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6" {...picker.dropProps}>
      {picker.inputs}
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow text-muted">Open dataset</p>
          <h1 className="mt-2 font-display text-[clamp(32px,4.4vw,52px)] font-extrabold leading-[1.02] tracking-[-0.04em]">
            <Words text="Teach it a new sign." immediate />{' '}
            <span className="font-serif font-normal italic text-turmeric-ink">
              <Words text="Help Kannada grow." delay={0.2} immediate />
            </span>
          </h1>
        </div>
        <Stepper steps={steps} />
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* 01 Photo */}
        <Section n="01" title="Photo" done={steps[0].done} className="lg:sticky lg:top-6 lg:col-span-5">
          {preview ? (
            <div className="flex flex-col gap-3">
              <motion.div
                key={preview}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="flex justify-center overflow-hidden rounded-2xl bg-night"
              >
                <img src={preview} alt="Photo to contribute" className="block max-h-[46vh] max-w-full" />
              </motion.div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {size && (
                  <span
                    className={clsx(
                      'num rounded-full px-2.5 py-1 text-xs font-bold',
                      tooSmall ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok',
                    )}
                  >
                    {size.w}×{size.h}px {tooSmall ? `· needs ${MIN_LONG_EDGE}px+` : '· good size'}
                  </span>
                )}
                <button onClick={picker.openUpload} className="text-sm font-bold text-muted hover:text-ink">
                  Change photo
                </button>
              </div>
            </div>
          ) : (
            <div
              className={clsx(
                'flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition',
                picker.dragging ? 'border-turmeric bg-turmeric-soft' : 'border-line',
              )}
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-turmeric-soft text-turmeric-ink">
                <ImageUp size={26} />
              </span>
              <p className="max-w-[260px] text-sm font-semibold text-muted">
                A sign you photographed yourself, at least {MIN_LONG_EDGE}px on the long edge.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={picker.openCamera} className="btn h-11 bg-ink px-5 text-sm text-paper">
                  <Camera size={16} /> Take photo
                </button>
                <button onClick={picker.openUpload} className="btn h-11 border border-line px-5 text-sm">
                  Upload
                </button>
              </div>
            </div>
          )}
        </Section>

        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* 02 Text */}
          <Section
            n="02"
            title="Text on the sign"
            done={steps[1].done}
            action={
              file && (
                <button
                  onClick={prefill}
                  disabled={busy !== null}
                  className="btn h-9 bg-turmeric-soft px-4 text-sm text-turmeric-ink hover:brightness-95"
                >
                  {busy === 'prefill' ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Pre-fill
                </button>
              )
            }
          >
            <p className="mb-3 text-sm font-semibold text-muted">
              Type exactly what is written, spelling mistakes included. Pre-fill does the typing, so you just check it.
            </p>
            <div className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {lines.map((l, i) => (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.4, ease: EASE, delay: i * 0.04 }}
                  >
                    <LineEditor
                      n={i + 1}
                      line={l}
                      onChange={(p) => update(i, p)}
                      onDelete={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <button
              onClick={() => setLines((ls) => [...ls, { kannada: '', translation: '', bbox: null }])}
              className="mt-3 flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink"
            >
              <Plus size={15} /> Add a line
            </button>
          </Section>

          {/* 03 Details */}
          <Section n="03" title="Details" done={steps[2].done}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Where was it?">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Mathikere, Bengaluru"
                  className="input"
                />
              </Field>
              <Field label="Your name or team ID">
                <input
                  value={contributor}
                  onChange={(e) => setContributor(e.target.value)}
                  placeholder="team-07"
                  className="input"
                />
              </Field>
            </div>
            <p className="mb-2 mt-4 text-sm font-bold text-ink-2">Kind of sign</p>
            <Chips
              options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ id: k, label: v }))}
              selected={[category]}
              onToggle={(id) => setCategory(id as Category)}
            />
            <p className="mb-2 mt-4 text-sm font-bold text-ink-2">Photo conditions</p>
            <Chips
              options={CONDITIONS.map((c) => ({ id: c.replace(/[ -]/g, '_'), label: c }))}
              selected={conditions}
              onToggle={(id) =>
                setConditions((cs) => (cs.includes(id) ? cs.filter((x) => x !== id) : [...cs, id]))
              }
            />
          </Section>

          {/* 04 Consent */}
          <Section n="04" title="Consent & privacy" done={steps[3].done}>
            <label className="flex cursor-pointer gap-3">
              <span
                className={clsx(
                  'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition',
                  consent ? 'border-ok bg-ok text-surface' : 'border-line',
                )}
              >
                <AnimatePresence>
                  {consent && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Check size={15} strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <input type="checkbox" className="sr-only" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="text-sm font-semibold leading-relaxed text-ink-2">
                I took this photo (or have permission to share it) and release it under <b>CC-BY-4.0</b> in the open
                Kannada dataset. No personal details are visible.
              </span>
            </label>
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-ok-soft px-3 py-2 text-xs font-bold text-ok">
              <ShieldCheck size={14} /> Faces and number plates are blurred automatically before saving.
            </p>
          </Section>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-bad-soft px-4 py-3 text-sm font-bold text-bad">
              {error}
            </motion.p>
          )}

          <button onClick={save} disabled={!canSave} className="btn h-14 w-full bg-ink text-base text-paper hover:opacity-90">
            {busy === 'save' ? <LoaderCircle size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            Blur & save to dataset
          </button>
          {!canSave && busy === null && (
            <p className="-mt-2 text-center text-xs font-bold text-muted">
              {!file ? 'Add a photo to start' : tooSmall ? 'Photo is too small' : !hasText ? 'Add the text on the sign' : 'Tick the consent box to save'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Stepper({ steps }: { steps: { label: string; done: boolean }[] }) {
  const doneCount = steps.filter((s) => s.done).length
  return (
    <div className="w-full max-w-[420px]">
      <div className="flex justify-between text-xs font-extrabold">
        {steps.map((s) => (
          <span key={s.label} className={clsx('flex items-center gap-1 transition-colors', s.done ? 'text-ok' : 'text-muted')}>
            {s.done && <Check size={12} strokeWidth={3} />} {s.label}
          </span>
        ))}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full bg-ok"
          animate={{ width: `${(doneCount / steps.length) * 100}%` }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </div>
    </div>
  )
}

function Section({
  n,
  title,
  done,
  action,
  className,
  children,
}: {
  n: string
  title: string
  done: boolean
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Reveal className={className} y={20}>
      <section className="rounded-[24px] bg-surface p-5 shadow-[0_1px_2px_rgba(20,20,20,0.05)] sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span
            className={clsx(
              'num grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold transition-colors duration-300',
              done ? 'bg-ok text-surface' : 'bg-paper text-muted',
            )}
          >
            {done ? <Check size={15} strokeWidth={3} /> : n}
          </span>
          <h2 className="flex-1 font-display text-xl font-extrabold tracking-tight">{title}</h2>
          {action}
        </div>
        {children}
      </section>
    </Reveal>
  )
}

export function LineEditor({
  n,
  line,
  onChange,
  onDelete,
}: {
  n: number
  line: EditLine
  onChange: (p: Partial<EditLine>) => void
  onDelete: () => void
}) {
  const [iso, setIso] = useState('')

  // Live romanisation from the same backend function the dataset uses (debounced).
  useEffect(() => {
    const text = line.kannada.trim()
    if (!text) {
      setIso('')
      return
    }
    const t = setTimeout(() => {
      api.transliterate(text).then((r) => setIso(r.iso)).catch(() => setIso(''))
    }, 300)
    return () => clearTimeout(t)
  }, [line.kannada])

  return (
    <div className="rounded-2xl bg-paper p-3">
      <div className="flex items-center gap-2">
        <span className="num w-6 text-center text-xs font-extrabold text-muted">{n}</span>
        <input
          value={line.kannada}
          onChange={(e) => onChange({ kannada: e.target.value })}
          placeholder="ಕನ್ನಡ ಪಠ್ಯ"
          lang="kn"
          className="input kn flex-1 text-lg"
        />
        <button onClick={onDelete} aria-label="Remove line" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-bad-soft hover:text-bad">
          <Trash2 size={16} />
        </button>
      </div>
      <AnimatePresence>
        {iso && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-8 mt-1.5 text-xs font-bold tracking-wide text-turmeric-ink"
          >
            {iso}
          </motion.p>
        )}
      </AnimatePresence>
      <input
        value={line.translation}
        onChange={(e) => onChange({ translation: e.target.value })}
        placeholder="English meaning"
        className="input ml-8 mt-2 w-[calc(100%-2rem)] text-sm"
      />
    </div>
  )
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: { id: string; label: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            aria-pressed={on}
            className={clsx(
              'relative h-9 rounded-full px-3.5 text-[13px] font-bold transition active:scale-95',
              on ? 'text-paper' : 'bg-paper text-ink-2 hover:bg-line',
            )}
          >
            {on && <motion.span className="absolute inset-0 rounded-full bg-ink" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink-2">{label}</span>
      {children}
    </label>
  )
}

function Saved({
  saved,
  onAnother,
  onViewDataset,
}: {
  saved: { id: string; face: number; plate: number; total: number }
  onAnother: () => void
  onViewDataset: () => void
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="grain mx-auto max-w-xl rounded-[28px] bg-night px-8 py-12 text-center text-night-text"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-glow-money/20 blur-[90px]" />
      <div className="relative z-[2]">
        <svg viewBox="0 0 80 80" className="mx-auto h-20 w-20" aria-hidden="true">
          <motion.circle
            cx="40" cy="40" r="36" fill="none" stroke="var(--glow-money)" strokeWidth="4"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: EASE }}
          />
          <motion.path
            d="M25 41 l10 10 l20 -22" fill="none" stroke="var(--glow-money)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.5, ease: EASE }}
          />
        </svg>
        <p lang="kn" className="kn mt-5 text-3xl font-bold">ಧನ್ಯವಾದಗಳು!</p>
        <p className="mt-1 font-serif text-2xl italic text-night-muted">Thank you.</p>
        <p className="mt-6 text-sm font-semibold text-night-muted">
          Saved as <code className="num text-glow-gold">{saved.id}</code> · blurred {saved.face} face
          {saved.face === 1 ? '' : 's'}, {saved.plate} plate{saved.plate === 1 ? '' : 's'}
        </p>
        {saved.total > 0 && (
          <p className="mt-6">
            <CountTo to={saved.total} from={Math.max(0, saved.total - 1)} className="num text-6xl font-extrabold text-glow-gold" />
            <span className="block text-sm font-bold text-night-muted">signs in the dataset</span>
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={onAnother} className="btn bg-glow-gold text-night">
            <Plus size={16} /> Add another
          </button>
          <button onClick={onViewDataset} className="btn border border-white/20 hover:bg-white/10">
            See the dataset
          </button>
        </div>
      </div>
    </motion.section>
  )
}

function toEdit(r: ReadResult): EditLine[] {
  return r.lines.map((l) => ({ kannada: l.kannada, translation: l.translation, bbox: l.bbox }))
}
