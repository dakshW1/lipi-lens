import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, ImageUp, LoaderCircle, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { EASE, Reveal, Words } from '../lib/motion'

const EXAMPLES = [
  { kind: 'Bus board', kn: 'ಮೆಜೆಸ್ಟಿಕ್', tr: 'mejesṭik', en: 'Majestic' },
  { kind: 'Milestone', kn: 'ಮೈಸೂರು ೧೨ ಕಿ.ಮೀ', tr: 'maisūru 12 ki.mī', en: 'Mysuru, 12 km' },
  { kind: 'Shop sign', kn: 'ಹಾಲು ಮತ್ತು ಮೊಸರು', tr: 'hālu mattu mosaru', en: 'Milk and curd' },
  { kind: 'Notice', kn: 'ಧೂಮಪಾನ ನಿಷೇಧಿಸಲಾಗಿದೆ', tr: 'dhūmapāna niṣēdhisalāgide', en: 'Smoking is prohibited' },
]

const MARQUEE = [
  ['ನಿಲ್ದಾಣ', 'station'],
  ['ಆಸ್ಪತ್ರೆ', 'hospital'],
  ['ಬಸ್ ನಿಲ್ದಾಣ', 'bus stop'],
  ['ನಿರ್ಗಮನ', 'exit'],
  ['ಮಾರುಕಟ್ಟೆ', 'market'],
  ['ದೇವಸ್ಥಾನ', 'temple'],
  ['ಶಾಲೆ', 'school'],
  ['ಔಷಧಾಲಯ', 'pharmacy'],
  ['ಉಪಾಹಾರ ಮಂದಿರ', 'restaurant'],
  ['ಎಚ್ಚರಿಕೆ', 'caution'],
]

const STEPS = [
  { n: '01', title: 'Snap', body: 'Photograph a bus board, shop sign, milestone or notice. Glare and angles are fine.' },
  { n: '02', title: 'Read', body: 'Lipi Lens finds every line of Kannada and copies it exactly as written.' },
  { n: '03', title: 'Understand', body: 'See how to say it, what it means in English, and hear it read aloud.' },
]

interface Props {
  onCamera: () => void
  onUpload: () => void
  onSample: () => void
  dragging: boolean
  preparing: boolean
}

export function Hero({ onCamera, onUpload, onSample, dragging, preparing }: Props) {
  const [ex, setEx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setEx((i) => (i + 1) % EXAMPLES.length), 3200)
    return () => clearInterval(id)
  }, [])
  const e = EXAMPLES[ex]

  return (
    <div className="flex flex-col gap-5">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className={clsx(
          'grain rounded-[28px] bg-night text-night-text transition-shadow duration-300',
          dragging && 'shadow-[0_0_0_3px_var(--glow-gold)]',
        )}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-glow-gold/20 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-glow-money/10 blur-[100px]" />

        <div className="relative z-[2] grid items-center gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <div>
            <div className="eyebrow flex items-center gap-3 text-night-muted">
              <span className="num text-glow-gold">ಲಿ</span>
              <span className="h-px w-10 bg-white/25" /> Kannada sign reader
            </div>
            <h1 className="mt-5 font-display text-[clamp(40px,6.4vw,80px)] font-extrabold leading-[0.95] tracking-[-0.045em]">
              <Words text="Read any Kannada sign." immediate />
              <br />
              <span className="font-serif font-normal italic tracking-[-0.02em] text-glow-gold">
                <Words text="In a snap." delay={0.25} immediate />
              </span>
            </h1>
            <Reveal delay={0.35} y={16}>
              <p className="mt-5 max-w-[460px] text-[16px] font-semibold leading-relaxed text-night-muted">
                Point your camera at a bus board, shop sign or notice. Get the Kannada, how to say it, and what it means.
              </p>
            </Reveal>
            <Reveal delay={0.45} y={16}>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={onCamera} className="btn bg-glow-gold text-night hover:brightness-105">
                  <Camera size={18} /> Take a photo
                </button>
                <button onClick={onUpload} className="btn border border-white/20 text-night-text hover:bg-white/10">
                  <ImageUp size={18} /> Upload
                </button>
                <button
                  onClick={onSample}
                  disabled={preparing}
                  className="btn px-4 text-night-muted hover:text-night-text disabled:opacity-70"
                  title="Try it with a generated bus-board photo"
                >
                  {preparing ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {preparing ? 'Preparing…' : 'Try a sample'}
                </button>
              </div>
              <p className="mt-4 hidden text-xs font-semibold text-night-muted/80 sm:block">
                or drop a photo anywhere on this card
              </p>
            </Reveal>
          </div>

          {/* Live example: a sign card that cycles through what Lipi Lens returns */}
          <motion.div
            initial={{ opacity: 0, rotateY: -18, rotateX: 8, y: 30 }}
            animate={{ opacity: 1, rotateY: -6, rotateX: 3, y: 0 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
            style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
            className="w-full"
            aria-hidden="true"
          >
            <div className="rounded-[24px] border border-night-line bg-night-2 p-5 shadow-[0_40px_100px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-night-muted">What you get</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={e.kind}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-full bg-glow-gold/15 px-2.5 py-1 text-[11px] font-extrabold text-glow-gold"
                  >
                    {e.kind}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="relative mt-4 overflow-hidden rounded-2xl bg-black px-5 py-7">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={e.kn}
                    lang="kn"
                    initial={{ opacity: 0, filter: 'blur(10px)', y: 10 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                    exit={{ opacity: 0, filter: 'blur(10px)', y: -10 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="kn led text-center text-[clamp(24px,3.4vw,38px)] font-bold text-glow-gold"
                  >
                    {e.kn}
                  </motion.p>
                </AnimatePresence>
                <motion.div
                  key={`beam-${ex}`}
                  className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                  initial={{ left: '-20%' }}
                  animate={{ left: '110%' }}
                  transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
                />
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={e.en} exit={{ opacity: 0 }} className="mt-4 grid gap-2">
                  <Row label="Say it" value={e.tr} gold delay={0.45} />
                  <Row label="Means" value={e.en} serif delay={0.6} />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Kannada word marquee */}
        <div className="relative z-[2] overflow-hidden border-t border-night-line py-4">
          <div className="marquee flex w-max gap-10 whitespace-nowrap">
            {[...MARQUEE, ...MARQUEE].map(([kn, en], i) => (
              <span key={i} className="flex items-baseline gap-2 text-sm">
                <span lang="kn" className="kn font-bold text-night-text">{kn}</span>
                <span className="font-serif italic text-night-muted">{en}</span>
              </span>
            ))}
          </div>
        </div>
      </motion.section>

      <div className="grid gap-5 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="h-full rounded-[24px] bg-surface p-6 shadow-[0_1px_2px_rgba(20,20,20,0.05)]">
              <span className="num text-sm font-extrabold text-turmeric-ink">{s.n}</span>
              <h3 className="mt-3 font-display text-2xl font-extrabold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[15px] font-semibold leading-relaxed text-muted">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}

function Row({ label, value, gold, serif, delay }: { label: string; value: string; gold?: boolean; serif?: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="flex items-baseline justify-between gap-4 rounded-xl bg-white/[0.04] px-4 py-3"
    >
      <span className="text-xs font-bold text-night-muted">{label}</span>
      <span
        className={clsx(
          'text-right',
          gold && 'font-bold tracking-wide text-glow-gold',
          serif && 'font-serif text-xl italic text-night-text',
        )}
      >
        {value}
      </span>
    </motion.div>
  )
}
