import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Plus,
  ShieldX,
  Undo2,
} from 'lucide-react'
import clsx from 'clsx'
import { api, CATEGORY_LABELS, type Category, type ReviewRecord } from '../api'
import { ImageWithBoxes } from '../components/ImageWithBoxes'
import { EASE, Words } from '../lib/motion'
import { LineEditor, type EditLine } from './ContributePage'

type Filter = 'todo' | 'done' | 'all'

const toEdit = (r: ReviewRecord): EditLine[] =>
  r.lines.map((l) => ({ kannada: l.kannada, translation: l.translation, bbox: l.bbox?.length === 4 ? l.bbox : null }))

export function ReviewPage() {
  const [records, setRecords] = useState<ReviewRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('todo')
  const [currentId, setCurrentId] = useState<string | null>(null)

  useEffect(() => {
    api
      .reviewList()
      .then((r) => setRecords(r.records))
      .catch((e) => setError((e as Error).message))
  }, [])

  const visible = useMemo(
    () =>
      (records ?? []).filter((r) => (filter === 'all' ? true : filter === 'done' ? r.reviewed : !r.reviewed)),
    [records, filter],
  )
  const current = visible.find((r) => r.id === currentId) ?? visible[0] ?? null
  const index = current ? visible.indexOf(current) : -1
  const total = records?.length ?? 0
  const reviewed = records?.filter((r) => r.reviewed).length ?? 0

  const goto = (i: number) => {
    const r = visible[Math.max(0, Math.min(visible.length - 1, i))]
    if (r) setCurrentId(r.id)
  }

  const replace = (rec: ReviewRecord) =>
    setRecords((rs) => (rs ? rs.map((r) => (r.id === rec.id ? rec : r)) : rs))

  // After approving in the "to review" list the record leaves the list, so the next one is
  // whatever now sits at the same index.
  const afterLeave = (i: number) => {
    const next = visible.filter((r) => r.id !== current?.id)[Math.min(i, visible.length - 2)]
    setCurrentId(next?.id ?? null)
  }

  if (error) {
    return <p className="rounded-2xl bg-bad-soft px-4 py-3 font-bold text-bad">{error}</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow text-muted">Dataset · human check</span>
          <h1 className="mt-2 font-display text-[clamp(32px,4.6vw,54px)] font-extrabold leading-[1] tracking-[-0.04em]">
            <Words text="Check every label." immediate />
          </h1>
          <p className="mt-2 max-w-xl font-semibold text-muted">
            Make the Kannada match the sign exactly, fix the meaning, then approve.{' '}
            <kbd className="rounded bg-surface px-1.5 py-0.5 text-xs">Ctrl</kbd>+
            <kbd className="rounded bg-surface px-1.5 py-0.5 text-xs">Enter</kbd> approves and moves on.
          </p>
        </div>
        <ProgressPill reviewed={reviewed} total={total} />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['todo', `To review · ${total - reviewed}`],
            ['done', `Reviewed · ${reviewed}`],
            ['all', `All · ${total}`],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setFilter(id)
              setCurrentId(null)
            }}
            className={clsx(
              'relative rounded-full px-4 py-2 text-sm font-extrabold transition',
              filter === id ? 'text-paper' : 'bg-surface text-muted hover:text-ink',
            )}
          >
            {filter === id && (
              <motion.span layoutId="review-filter" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
            )}
            <span className="relative">{label}</span>
          </button>
        ))}
        <div className="flex-1" />
        {current && (
          <div className="flex items-center gap-1 text-sm font-bold text-muted">
            <button onClick={() => goto(index - 1)} disabled={index <= 0} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface disabled:opacity-30" aria-label="Previous">
              <ArrowLeft size={17} />
            </button>
            <span className="num w-20 text-center">
              {index + 1} / {visible.length}
            </span>
            <button onClick={() => goto(index + 1)} disabled={index >= visible.length - 1} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface disabled:opacity-30" aria-label="Next">
              <ArrowRight size={17} />
            </button>
          </div>
        )}
      </div>

      {records === null ? (
        <div className="grid h-80 place-items-center rounded-[24px] bg-surface">
          <LoaderCircle className="animate-spin text-muted" />
        </div>
      ) : !current ? (
        <div className="rounded-[24px] bg-surface p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ok-soft text-ok">
            <Check size={26} />
          </span>
          <h2 className="mt-4 font-display text-2xl font-extrabold">
            {filter === 'todo' ? 'Everything is reviewed.' : 'Nothing here yet.'}
          </h2>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <Editor
              record={current}
              onSaved={(rec) => {
                const i = index
                replace(rec)
                if (filter === 'todo' && rec.reviewed) afterLeave(i)
                else if (filter === 'done' && !rec.reviewed) afterLeave(i)
                else goto(i + 1)
              }}
              onRejected={() => {
                const i = index
                afterLeave(i)
                setRecords((rs) => (rs ? rs.filter((r) => r.id !== current.id) : rs))
              }}
            />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

function ProgressPill({ reviewed, total }: { reviewed: number; total: number }) {
  const pct = total ? reviewed / total : 0
  return (
    <div className="w-full max-w-[280px] rounded-[20px] bg-night p-4 text-night-text">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold text-night-muted">Reviewed</span>
        <span className="num text-sm font-extrabold">
          {reviewed} <span className="text-night-muted">/ {total}</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-glow-gold"
          initial={false}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </div>
    </div>
  )
}

function Editor({
  record,
  onSaved,
  onRejected,
}: {
  record: ReviewRecord
  onSaved: (r: ReviewRecord) => void
  onRejected: () => void
}) {
  const [lines, setLines] = useState<EditLine[]>(() => toEdit(record))
  const [category, setCategory] = useState<Category>(record.category)
  const [active, setActive] = useState<number | null>(null)
  const [busy, setBusy] = useState<'save' | 'reject' | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(
    async (reviewedFlag: boolean) => {
      setBusy('save')
      setError(null)
      try {
        onSaved(await api.reviewSave(record.id, { lines, category, reviewed: reviewedFlag }))
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(null)
      }
    },
    [record.id, lines, category, onSaved],
  )

  const reject = async () => {
    if (!confirmReject) {
      setConfirmReject(true)
      return
    }
    setBusy('reject')
    try {
      await api.reviewReject(record.id)
      onRejected()
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !busy) {
        e.preventDefault()
        save(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save, busy])

  const update = (i: number, patch: Partial<EditLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  return (
    <div className="grid items-start gap-5 lg:grid-cols-12">
      <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:col-span-6">
        <ImageWithBoxes
          src={record.image_url}
          boxes={lines.map((l) => (l.bbox?.length === 4 ? (l.bbox as [number, number, number, number]) : null))}
          active={active}
          onHover={setActive}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs font-bold text-muted">
          <span className="num text-ink">{record.id}</span>
          {record.author && <span>© {record.author}</span>}
          {record.license && <span>{record.license}</span>}
          {record.source && (
            <a href={record.source} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink">
              Source <ExternalLink size={11} />
            </a>
          )}
          {record.geo && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${record.geo.lat}&mlon=${record.geo.lon}#map=17/${record.geo.lat}/${record.geo.lon}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-ink"
            >
              <MapPin size={11} /> {record.geo.lat.toFixed(4)}, {record.geo.lon.toFixed(4)}
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-6">
        <section className="rounded-[24px] bg-surface p-5">
          <span className="eyebrow text-muted">Kind of sign</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={clsx(
                  'rounded-full px-3.5 py-1.5 text-sm font-extrabold transition',
                  category === c ? 'bg-ink text-paper' : 'bg-paper text-muted hover:text-ink',
                )}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-muted">Text lines · {lines.length}</span>
            {record.reviewed && (
              <span className="rounded-full bg-ok-soft px-2.5 py-1 text-[11px] font-extrabold text-ok">Reviewed</span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {lines.map((line, i) => (
              <div
                key={i}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className={clsx('rounded-2xl transition', active === i && 'ring-2 ring-turmeric')}
              >
                <LineEditor
                  n={i + 1}
                  line={line}
                  onChange={(p) => update(i, p)}
                  onDelete={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                />
              </div>
            ))}
            <button
              onClick={() => setLines((ls) => [...ls, { kannada: '', translation: '', bbox: null }])}
              className="btn h-10 justify-center border border-dashed border-line text-sm text-muted hover:text-ink"
            >
              <Plus size={15} /> Add a line the model missed
            </button>
          </div>
        </section>

        {error && <p className="rounded-2xl bg-bad-soft px-4 py-3 text-sm font-bold text-bad">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => save(true)} disabled={!!busy} className="btn bg-ink text-paper disabled:opacity-60">
            {busy === 'save' ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
            Approve &amp; next
          </button>
          {record.reviewed && (
            <button onClick={() => save(false)} disabled={!!busy} className="btn bg-surface text-sm text-muted hover:text-ink">
              <Undo2 size={15} /> Mark unreviewed
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={reject}
            onMouseLeave={() => setConfirmReject(false)}
            disabled={!!busy}
            className={clsx(
              'btn text-sm transition',
              confirmReject ? 'bg-bad text-white' : 'text-muted hover:bg-bad-soft hover:text-bad',
            )}
          >
            {busy === 'reject' ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldX size={15} />}
            {confirmReject ? 'Click again to reject' : 'Reject photo'}
          </button>
        </div>
        <p className="px-1 text-xs font-semibold text-muted">
          Reject photos with no readable Kannada, unblurred faces or private information. Rejected photos move to
          dataset/rejected/.
        </p>
      </div>
    </div>
  )
}
