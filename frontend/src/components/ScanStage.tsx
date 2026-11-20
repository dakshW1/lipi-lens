import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CircleCheck, Languages, LoaderCircle, ScanSearch, Type, Volume2 } from 'lucide-react'
import { EASE, Words } from '../lib/motion'

const STEPS = [
  { name: 'Finding text', detail: 'Locating every sign line in the photo', icon: ScanSearch },
  { name: 'Reading Kannada', detail: 'Copying each letter exactly as written', icon: Type },
  { name: 'Romanising', detail: 'Turning script into how it sounds', icon: Volume2 },
  { name: 'Translating', detail: 'Writing what it means in English', icon: Languages },
]

/** Full-width night stage shown while a photo is being read. `done` completes the last steps. */
export function ScanStage({ src, done }: { src: string; done: boolean }) {
  const [stage, setStage] = useState(0)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const t = [500, 1100, 1700].map((ms, i) => setTimeout(() => setStage((s) => Math.max(s, i + 1)), ms))
    t.push(setTimeout(() => setSlow(true), 20000))
    return () => t.forEach(clearTimeout)
  }, [])
  // Finish only after the first three steps have played, so the sequence reads even on instant answers.
  useEffect(() => {
    if (done && stage >= STEPS.length - 1) setStage(STEPS.length)
  }, [done, stage])

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="grain rounded-[28px] bg-night text-night-text"
    >
      <div className="pointer-events-none absolute -right-20 top-10 h-96 w-96 rounded-full bg-glow-gold/15 blur-[110px]" />
      <div className="relative z-[2] grid items-center gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        <div className="mx-auto w-full max-w-[480px]" style={{ perspective: 1400 }}>
          <motion.div
            initial={{ rotateY: -28, rotateX: 12, y: 50, opacity: 0 }}
            animate={{ rotateY: -9, rotateX: 5, y: 0, opacity: 1 }}
            transition={{ duration: 1.1, ease: EASE }}
            className="relative overflow-hidden rounded-[24px] shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
          >
            <img src={src} alt="Your photo" className="block max-h-[52vh] w-full object-cover" />
            <motion.div
              className="absolute inset-x-0 h-28"
              style={{ background: 'linear-gradient(180deg, transparent, rgba(242,193,78,0.22), transparent)' }}
              animate={{ top: ['-15%', '100%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' }}
            >
              <div className="absolute inset-x-0 top-1/2 h-[2px] bg-glow-gold shadow-[0_0_24px_#F2C14E]" />
            </motion.div>
          </motion.div>
        </div>

        <div>
          <div className="eyebrow mb-5 flex items-center gap-3 text-night-muted">
            <span className="num text-glow-gold">··</span>
            <span className="h-px w-10 bg-white/25" /> Reading your photo
          </div>
          <h2 className="font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[1] tracking-[-0.045em]">
            <Words text="Reading the sign." immediate />
          </h2>
          <motion.p
            lang="kn"
            initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
            className="kn mt-2 text-[clamp(22px,3vw,36px)] font-bold text-glow-gold"
          >
            ಓದುತ್ತಿದೆ…
          </motion.p>

          <ol className="mt-8 flex max-w-[520px] flex-col gap-2.5">
            {STEPS.map((s, i) => {
              const state = stage > i ? 'done' : stage === i ? 'working' : 'waiting'
              return (
                <motion.li
                  key={s.name}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: state === 'waiting' ? 0.4 : 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.08, ease: EASE, duration: 0.6 }}
                  className={`flex items-center gap-4 rounded-2xl border px-3 py-3 transition-colors ${
                    state === 'working' ? 'border-white/25 bg-white/10' : 'border-night-line bg-night-2/70'
                  }`}
                >
                  <span className="num w-6 text-center text-sm font-extrabold text-night-muted">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-glow-gold/15 text-glow-gold">
                    <s.icon size={20} />
                    {state === 'working' && (
                      <span className="pulse-ring absolute inset-0 rounded-xl border-2 border-glow-gold" />
                    )}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-extrabold">{s.name}</span>
                    <span className="text-xs font-bold text-night-muted">{s.detail}</span>
                  </span>
                  {state === 'done' && <CircleCheck className="text-glow-money" size={20} />}
                  {state === 'working' && <LoaderCircle className="animate-spin text-night-muted" size={20} />}
                </motion.li>
              )
            })}
          </ol>
          {slow && !done && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 max-w-[520px] text-sm font-semibold text-night-muted"
            >
              Taking longer than usual. Busy signs with lots of text can take up to half a minute.
            </motion.p>
          )}
        </div>
      </div>
    </motion.section>
  )
}
