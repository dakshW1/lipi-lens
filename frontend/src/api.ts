export type Category = 'bus_board' | 'shop_sign' | 'milestone' | 'poster' | 'govt_notice' | 'other'

export const CATEGORY_LABELS: Record<Category, string> = {
  bus_board: 'Bus board',
  shop_sign: 'Shop sign',
  milestone: 'Milestone',
  poster: 'Poster',
  govt_notice: 'Govt notice',
  other: 'Other',
}

export interface Line {
  kannada: string
  transliteration: string
  romanized: string
  translation: string
  bbox: [number, number, number, number] | null
  confidence: number
}

export interface ReadResult {
  lines: Line[]
  category: Category
  structured: { route_no: string; destination: string; via: string[] } | null
  image: { width: number; height: number }
  latency_ms: number
  demo: boolean
  cached?: boolean
}

export interface Health {
  ok: boolean
  demo: boolean
  model: string
}

export interface Stats {
  samples: number
  lines: number
  reviewed: number
  avg_lines: number
  mixed_script: number
  by_category: Partial<Record<Category, number>>
  by_condition: Record<string, number>
  by_contributor: Record<string, number>
  by_day: { date: string; count: number }[]
  recent: { id: string; image: string; kannada: string; translation: string; category: Category; reviewed: boolean }[]
}

export interface ReviewRecord {
  id: string
  image: string
  image_url: string
  category: Category
  location: string
  lines: { kannada: string; transliteration: string; translation: string; bbox: number[] }[]
  reviewed: boolean
  contributor: string
  license: string
  source?: string
  author?: string
  geo?: { lat: number; lon: number }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new Error('Cannot reach the Lipi Lens server. Is the backend running?')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`)
  return body as T
}

export const api = {
  health: () => request<Health>('/api/health'),
  stats: () => request<Stats>('/api/stats'),
  transliterate: (text: string) =>
    request<{ iso: string; simple: string }>(`/api/transliterate?text=${encodeURIComponent(text)}`),

  reviewList: () => request<{ records: ReviewRecord[] }>('/api/review'),
  reviewSave: (
    id: string,
    body: { lines: { kannada: string; translation: string; bbox: number[] | null }[]; category: Category; reviewed: boolean },
  ) =>
    request<ReviewRecord>(`/api/review/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  reviewReject: (id: string) => request<{ rejected: string }>(`/api/review/${id}/reject`, { method: 'POST' }),

  read(file: Blob) {
    const fd = new FormData()
    fd.append('file', file, 'photo.jpg')
    return request<ReadResult>('/api/read', { method: 'POST', body: fd })
  },

  contribute(input: {
    file: Blob
    lines: { kannada: string; translation: string; bbox: number[] | null }[]
    category: Category
    location: string
    conditions: string[]
    contributor: string
    consent: boolean
  }) {
    const fd = new FormData()
    fd.append('file', input.file, 'photo.jpg')
    fd.append('lines', JSON.stringify(input.lines))
    fd.append('category', input.category)
    fd.append('location', input.location)
    fd.append('conditions', JSON.stringify(input.conditions))
    fd.append('contributor', input.contributor)
    fd.append('consent', String(input.consent))
    return request<{ saved: string; blurred: { face: number; plate: number } }>('/api/contribute', {
      method: 'POST',
      body: fd,
    })
  },
}

/** Speak Kannada text with the browser's TTS. Returns false if no Kannada voice exists. */
export function speakKannada(text: string): boolean {
  if (!('speechSynthesis' in window)) return false
  const voices = window.speechSynthesis.getVoices()
  const voice = voices.find((v) => v.lang.toLowerCase().startsWith('kn'))
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'kn-IN'
  u.rate = 0.85
  if (voice) u.voice = voice
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
  return Boolean(voice) || voices.length === 0
}
