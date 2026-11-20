import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, BadgeCheck, Database, FileJson, Images, Languages, Rows3, ScanText } from 'lucide-react'
import clsx from 'clsx'
import { api, CATEGORY_LABELS, type Category, type Stats } from '../api'
import { CountTo, EASE, Reveal, Ring, Words } from '../lib/motion'

const GOAL = 150
const DAILY_PACE = 50 // 150 images across the three build days

export function DatasetPage({ onContribute }: { onContribute: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.stats().then(setStats).catch((e: Error) => setError(e.message))
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">Open Kannada dataset</p>
          <h1 className="mt-2 font-display text-[clamp(32px,4.4vw,52px)] font-extrabold leading-[1.02] tracking-[-0.04em]">
            <Words text="The dataset," immediate />{' '}
            <span className="font-serif font-normal italic text-turmeric-ink">
              <Words text="so far." delay={0.15} immediate />
            </span>
          </h1>
        </div>
        <button onClick={onContribute} className="btn bg-ink text-paper">
          Add a sign <ArrowRight size={16} />
        </button>
      </header>

      {error && <p className="rounded-2xl bg-bad-soft px-4 py-3 text-sm font-bold text-bad">{error}</p>}
      {!stats && !error && <Skeleton />}
      {stats && stats.samples === 0 && <Empty onContribute={onContribute} />}
      {stats && stats.samples > 0 && <Dashboard s={stats} />}
      {stats && <FormatCard />}
    </div>
  )
}

function Dashboard({ s }: { s: Stats }) {
  const progress = s.samples / GOAL
  const toGo = Math.max(0, GOAL - s.samples)
  const reviewedPct = s.samples ? s.reviewed / s.samples : 0
  const mixedPct = s.samples ? s.mixed_script / s.samples : 0

  const cats = (Object.keys(CATEGORY_LABELS) as Category[])
    .map((c) => ({ key: c, label: CATEGORY_LABELS[c], value: s.by_category[c] ?? 0 }))
    .sort((a, b) => b.value - a.value)
  const conds = Object.entries(s.by_condition)
    .map(([k, v]) => ({ key: k, label: k.replace(/_/g, ' '), value: v }))
    .sort((a, b) => b.value - a.value)
  const people = Object.entries(s.by_contributor).map(([k, v]) => ({ key: k, label: k, value: v }))

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Headline: progress to goal */}
        <Reveal className="lg:col-span-5">
          <section className="grain h-full rounded-[24px] bg-night p-6 text-night-text">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-glow-gold/20 blur-[70px]" />
            <div className="relative z-[2] flex items-center gap-6">
              <Ring progress={progress} label={`${Math.round(progress * 100)}% of ${GOAL} image goal`}>
                <CountTo to={Math.min(100, Math.round(progress * 100))} suffix="%" className="num text-[26px] font-extrabold" />
              </Ring>
              <div className="flex flex-col gap-1.5">
                <span className="eyebrow text-night-muted">Labelled images</span>
                <CountTo to={s.samples} className="num text-[52px] font-extrabold leading-none text-glow-gold" />
                <span className="text-sm font-bold text-night-muted">of {GOAL} goal</span>
                <span className="mt-2 text-[15px] font-extrabold">
                  {toGo > 0 ? `${toGo} to go` : 'Goal reached. ಅದ್ಭುತ!'}
                </span>
              </div>
            </div>
          </section>
        </Reveal>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-5 lg:col-span-7">
          <Tile icon={Rows3} label="Text lines" delay={0.05}>
            <CountTo to={s.lines} className="num text-[40px] font-extrabold leading-none" />
          </Tile>
          <Tile icon={BadgeCheck} label="Human-reviewed" delay={0.1}>
            <div className="flex items-baseline gap-1.5">
              <CountTo to={s.reviewed} className="num text-[40px] font-extrabold leading-none" />
              <span className="num text-sm font-bold text-muted">/ {s.samples}</span>
            </div>
            <MiniBar value={reviewedPct} />
          </Tile>
          <Tile icon={ScanText} label="Lines per image" delay={0.15}>
            <CountTo to={s.avg_lines} decimals={1} className="num text-[40px] font-extrabold leading-none" />
          </Tile>
          <Tile icon={Languages} label="Kannada + English" delay={0.2}>
            <CountTo to={Math.round(mixedPct * 100)} suffix="%" className="num text-[40px] font-extrabold leading-none" />
            <MiniBar value={mixedPct} />
          </Tile>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Card title="Collected per day" note={`Pace needed: ${DAILY_PACE}/day`} className="lg:col-span-7">
          <DayChart days={s.by_day} />
        </Card>
        <Card title="Kinds of sign" note={`${cats.filter((c) => c.value).length} of 6 covered`} className="lg:col-span-5">
          <HBars rows={cats} total={s.samples} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Card title="Photo conditions" note="Variety makes a better test set" className="lg:col-span-5">
          {conds.length ? (
            <HBars rows={conds} total={s.samples} />
          ) : (
            <p className="text-sm font-semibold text-muted">No conditions tagged yet.</p>
          )}
        </Card>
        <Card title="Top contributors" className="lg:col-span-7">
          <Leaderboard rows={people} />
        </Card>
      </div>

      {s.recent.length > 0 && (
        <Card title="Latest signs" note="Faces and plates blurred">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {s.recent.map((r, i) => (
              <motion.figure
                key={r.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="group overflow-hidden rounded-2xl bg-paper"
              >
                <div className="aspect-[4/3] overflow-hidden bg-night">
                  <img src={r.image} alt={r.translation || r.kannada} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <figcaption className="p-3">
                  <p lang="kn" className="kn truncate text-[15px] font-bold">{r.kannada}</p>
                  <p className="truncate font-serif text-sm italic text-muted">{r.translation}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="num text-[11px] font-bold text-muted">{r.id}</span>
                    <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-extrabold', r.reviewed ? 'bg-ok-soft text-ok' : 'bg-turmeric-soft text-turmeric-ink')}>
                      {r.reviewed ? 'reviewed' : 'to review'}
                    </span>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

/* ---------- charts ---------- */

/** Single-series vertical bars, one per day, with the daily pace as a dashed reference line. */
function DayChart({ days }: { days: Stats['by_day'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(DAILY_PACE, ...days.map((d) => d.count)) * 1.15
  const today = days.length - 1
  return (
    <div>
      <div className="relative h-52" onMouseLeave={() => setHover(null)}>
        {/* recessive gridline + pace reference */}
        <div className="absolute inset-x-0 bottom-0 border-t border-line" />
        <div
          className="absolute inset-x-0 border-t-2 border-dashed border-ok/40"
          style={{ bottom: `${(DAILY_PACE / max) * 100}%` }}
        >
          <span className="absolute -top-5 right-0 text-[11px] font-extrabold text-ok">pace {DAILY_PACE}</span>
        </div>
        <div className="absolute inset-0 flex items-end gap-[6px] sm:gap-3">
          {days.map((d, i) => {
            const h = (d.count / max) * 100
            const showLabel = hover === i || (hover === null && i === today && d.count > 0)
            return (
              <div
                key={d.date}
                className="relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHover(i)}
              >
                <AnimatePresence>
                  {showLabel && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] font-extrabold text-paper"
                      style={{ bottom: `calc(${h}% + 8px)` }}
                    >
                      {d.count} {d.count === 1 ? 'image' : 'images'} · {fmtDay(d.date, true)}
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div
                  className={clsx(
                    'w-full max-w-[44px] rounded-t-[4px] transition-colors',
                    i === today ? 'bg-turmeric' : 'bg-turmeric/45',
                    hover === i && 'bg-turmeric',
                  )}
                  initial={{ height: 0 }}
                  whileInView={{ height: `${Math.max(h, d.count ? 2 : 0)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease: EASE, delay: i * 0.06 }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-[6px] sm:gap-3">
        {days.map((d, i) => (
          <span key={d.date} className={clsx('flex-1 text-center text-[11px] font-bold', i === today ? 'text-ink' : 'text-muted')}>
            {i === today ? 'Today' : fmtDay(d.date)}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Sorted horizontal bars (single series). Hover shows the share of all images. */
function HBars({ rows, total }: { rows: { key: string; label: string; value: number }[]; total: number }) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-1" onMouseLeave={() => setHover(null)}>
      {rows.map((r, i) => (
        <li
          key={r.key}
          onMouseEnter={() => setHover(r.key)}
          className={clsx(
            'grid grid-cols-[minmax(84px,7.5rem)_1fr_3.2rem] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors',
            hover === r.key && 'bg-paper',
          )}
        >
          <span className={clsx('truncate text-sm font-bold capitalize', r.value ? 'text-ink-2' : 'text-muted')}>{r.label}</span>
          <div className="h-3 overflow-hidden rounded-[4px] bg-paper">
            <motion.div
              className="h-full rounded-r-[4px] bg-turmeric"
              initial={{ width: 0 }}
              whileInView={{ width: `${(r.value / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.1 + i * 0.05 }}
            />
          </div>
          <span className="num text-right text-sm font-extrabold">
            {hover === r.key && total ? `${Math.round((r.value / total) * 100)}%` : r.value}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Leaderboard({ rows }: { rows: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <motion.li
          key={r.key}
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE, delay: i * 0.07 }}
          className="flex items-center gap-3 rounded-2xl bg-paper px-3 py-2.5"
        >
          <span className={clsx('num grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold', i === 0 ? 'bg-turmeric text-night' : 'bg-surface text-muted')}>
            {i + 1}
          </span>
          <span className="w-28 truncate text-sm font-extrabold sm:w-40">{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-[4px] bg-surface">
            <motion.div
              className="h-full rounded-r-[4px] bg-ink/70"
              initial={{ width: 0 }}
              whileInView={{ width: `${(r.value / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.07 }}
            />
          </div>
          <span className="num w-10 text-right text-sm font-extrabold">{r.value}</span>
        </motion.li>
      ))}
    </ol>
  )
}

/* ---------- pieces ---------- */

function Tile({
  icon: Icon,
  label,
  delay,
  children,
}: {
  icon: typeof Rows3
  label: string
  delay: number
  children: React.ReactNode
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="flex h-full flex-col justify-between gap-4 rounded-[24px] bg-surface p-5 shadow-[0_1px_2px_rgba(20,20,20,0.05)]">
        <span className="flex items-center gap-2 text-sm font-bold text-muted">
          <Icon size={16} /> {label}
        </span>
        <div>{children}</div>
      </div>
    </Reveal>
  )
}

function MiniBar({ value }: { value: number }) {
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
      <motion.div
        className="h-full rounded-full bg-ok"
        initial={{ width: 0 }}
        whileInView={{ width: `${Math.round(value * 100)}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: EASE, delay: 0.3 }}
      />
    </div>
  )
}

function Card({ title, note, className, children }: { title: string; note?: string; className?: string; children: React.ReactNode }) {
  return (
    <Reveal className={className}>
      <section className="h-full rounded-[24px] bg-surface p-5 shadow-[0_1px_2px_rgba(20,20,20,0.05)] sm:p-6">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold tracking-tight">{title}</h2>
          {note && <span className="text-xs font-bold text-muted">{note}</span>}
        </div>
        {children}
      </section>
    </Reveal>
  )
}

function Empty({ onContribute }: { onContribute: () => void }) {
  return (
    <Reveal>
      <section className="grain rounded-[28px] bg-night px-6 py-14 text-center text-night-text">
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-glow-gold/15 blur-[90px]" />
        <div className="relative z-[2] mx-auto max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-glow-gold/15 text-glow-gold">
            <Images size={30} />
          </span>
          <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight">No signs yet</h2>
          <p className="mt-2 font-semibold text-night-muted">
            Photograph a few signs around campus and add them. Charts for progress, sign types and contributors show up
            here as soon as the first one is saved.
          </p>
          <button onClick={onContribute} className="btn mt-7 bg-glow-gold text-night">
            Add the first sign <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </Reveal>
  )
}

function FormatCard() {
  const items = [
    { icon: Images, k: 'Images', v: 'JPEG, ≥1280px, faces & plates blurred' },
    { icon: FileJson, k: 'Labels', v: 'dataset/labels.jsonl, one record per image' },
    { icon: Languages, k: 'Text', v: 'UTF-8 Kannada Unicode + ISO 15919 + English' },
    { icon: Database, k: 'Licence', v: 'CC-BY-4.0, consent recorded per sample' },
  ]
  return (
    <Reveal>
      <section className="grid gap-3 rounded-[24px] bg-surface-2 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, k, v }) => (
          <div key={k} className="flex gap-3">
            <Icon size={18} className="mt-0.5 shrink-0 text-turmeric-ink" />
            <div>
              <p className="text-sm font-extrabold">{k}</p>
              <p className="text-xs font-semibold text-muted">{v}</p>
            </div>
          </div>
        ))}
      </section>
    </Reveal>
  )
}

function Skeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="h-52 animate-pulse rounded-[24px] bg-surface lg:col-span-5" />
      <div className="h-52 animate-pulse rounded-[24px] bg-surface lg:col-span-7" />
    </div>
  )
}

function fmtDay(iso: string, long = false) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', long ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'short' })
}
