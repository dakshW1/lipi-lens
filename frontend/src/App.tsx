import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import Lenis from 'lenis'
import { Database, HeartHandshake, ListChecks, Moon, ScanText, Sun } from 'lucide-react'
import clsx from 'clsx'
import { api, type Health, type ReadResult } from './api'
import { ReadPage } from './pages/ReadPage'
import { ContributePage } from './pages/ContributePage'
import { DatasetPage } from './pages/DatasetPage'
import { ReviewPage } from './pages/ReviewPage'
import { EASE } from './lib/motion'
import { useTheme } from './lib/theme'

type Page = 'read' | 'contribute' | 'dataset' | 'review'

const NAV: { id: Page; label: string; icon: typeof ScanText }[] = [
  { id: 'read', label: 'Read a sign', icon: ScanText },
  { id: 'contribute', label: 'Contribute', icon: HeartHandshake },
  { id: 'dataset', label: 'Dataset', icon: Database },
  { id: 'review', label: 'Review labels', icon: ListChecks },
]

export default function App() {
  const [page, setPage] = useState<Page>('read')
  const [health, setHealth] = useState<Health | null | undefined>(undefined)
  const [handoff, setHandoff] = useState<{ file: File; result: ReadResult } | null>(null)
  const { theme, toggle } = useTheme()
  const lenis = useRef<Lenis | null>(null)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  // Smooth scrolling, off for people who ask for reduced motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    lenis.current = new Lenis({ autoRaf: true, lerp: 0.09 })
    return () => {
      lenis.current?.destroy()
      lenis.current = null
    }
  }, [])

  const go = (p: Page) => {
    if (lenis.current) lenis.current.scrollTo(0, { immediate: true })
    else window.scrollTo({ top: 0 })
    setPage(p)
  }

  const status = health === undefined ? null : !health ? 'offline' : health.demo ? 'demo' : 'live'

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-paper lg:pl-[84px]">
        {/* Desktop rail */}
        <nav aria-label="Main" className="fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col items-center gap-2 bg-surface py-5 lg:flex">
          <Logo onClick={() => go('read')} />
          <div className="mt-4 flex flex-col gap-2">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => go(id)}
                aria-label={label}
                aria-current={page === id ? 'page' : undefined}
                className={clsx(
                  'group relative grid h-12 w-12 cursor-pointer place-items-center rounded-2xl transition-colors',
                  page === id ? 'text-paper' : 'text-muted hover:bg-paper hover:text-ink',
                )}
              >
                {page === id && (
                  <motion.span layoutId="rail-pill" className="absolute inset-0 rounded-2xl bg-ink" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <Icon size={21} strokeWidth={1.9} className="relative" />
                <span className="pointer-events-none absolute left-[62px] z-50 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-paper opacity-0 transition group-hover:opacity-100">
                  {label}
                </span>
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <ThemeButton theme={theme} onClick={toggle} />
          <StatusDot status={status} model={health?.model} />
        </nav>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-paper/85 px-4 backdrop-blur-md lg:hidden">
          <button onClick={() => go('read')} className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-lg font-extrabold tracking-tight">Lipi Lens</span>
          </button>
          <div className="flex items-center gap-1">
            <StatusDot status={status} model={health?.model} compact />
            <ThemeButton theme={theme} onClick={toggle} />
          </div>
        </header>

        {status === 'offline' && (
          <div className="bg-bad-soft px-5 py-2.5 text-center text-[13px] font-bold text-bad">
            Can't reach the Lipi Lens server. Start the backend (see README), then refresh.
          </div>
        )}

        <main className="mx-auto max-w-[1240px] px-4 pb-28 pt-4 sm:px-6 lg:pb-12 lg:pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              {page === 'read' && (
                <ReadPage
                  onContribute={(file, result) => {
                    setHandoff({ file, result })
                    go('contribute')
                  }}
                />
              )}
              {page === 'contribute' && (
                <ContributePage
                  key={handoff ? handoff.file.name + handoff.file.lastModified : 'new'}
                  initial={handoff}
                  onViewDataset={() => go('dataset')}
                />
              )}
              {page === 'review' && <ReviewPage />}
              {page === 'dataset' && (
                <DatasetPage
                  onContribute={() => {
                    setHandoff(null)
                    go('contribute')
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
          <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-muted">
            <span>Modalapada 2.0 · Image track · Lipi Lens</span>
            <span lang="kn" className="kn">ಕನ್ನಡ ಬೆಳೆಯಲಿ</span>
          </footer>
        </main>

        {/* Mobile bottom tabs */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 flex h-[72px] items-stretch justify-around border-t border-line bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => go(id)}
              aria-current={page === id ? 'page' : undefined}
              className={clsx('flex min-w-[72px] flex-col items-center justify-center gap-1 text-[11px] font-bold', page === id ? 'text-ink' : 'text-muted')}
            >
              <span className="relative grid h-8 w-14 place-items-center">
                {page === id && (
                  <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <Icon size={19} className={clsx('relative', page === id && 'text-paper')} />
              </span>
              {label.split(' ')[0]}
            </button>
          ))}
        </nav>
      </div>
    </MotionConfig>
  )
}

function LogoMark() {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-night">
      <span lang="kn" className="kn -mt-0.5 text-[19px] font-extrabold text-glow-gold">ಲಿ</span>
    </span>
  )
}

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Lipi Lens home" className="cursor-pointer transition active:scale-95">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-night">
        <span lang="kn" className="kn -mt-0.5 text-[22px] font-extrabold text-glow-gold">ಲಿ</span>
      </span>
    </button>
  )
}

function ThemeButton({ theme, onClick }: { theme: 'light' | 'dark'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="grid h-11 w-11 cursor-pointer place-items-center rounded-2xl text-muted transition hover:bg-paper hover:text-ink"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.25 }}
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

function StatusDot({ status, model, compact }: { status: 'live' | 'demo' | 'offline' | null; model?: string; compact?: boolean }) {
  if (!status) return null
  const color = status === 'live' ? 'bg-ok' : status === 'demo' ? 'bg-turmeric' : 'bg-bad'
  const text = status === 'live' ? `Live · ${model}` : status === 'demo' ? 'Demo mode: no API key' : 'Server offline'
  return (
    <span
      title={text}
      className={clsx(
        'flex items-center gap-1.5 rounded-full text-[11px] font-extrabold text-muted',
        compact ? 'bg-surface px-2.5 py-1.5' : 'mt-2 h-10 w-10 justify-center',
      )}
    >
      <span className="relative flex h-2.5 w-2.5">
        {status === 'live' && <span className={clsx('pulse-ring absolute inset-0 rounded-full', color)} />}
        <span className={clsx('relative h-2.5 w-2.5 rounded-full', color)} />
      </span>
      {compact && (status === 'live' ? 'Live' : status === 'demo' ? 'Demo' : 'Offline')}
    </span>
  )
}
