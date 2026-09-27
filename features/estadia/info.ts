/**
 * Informações da hospedagem que o dono edita em Configurações e o hóspede vê
 * no app da estadia. No formulário cada lista é um texto com um item por
 * linha e campos separados por "|"; no banco vira JSON.
 */

export type Facility = { name: string; hours: string }
export type AgendaItem = { time: string; title: string; note: string }
export type LocalTip = { name: string; kind: string; distance: string }
export type EmergencyContact = { label: string; phone: string }

export const LIST_LIMITS = { facilities: 15, dailyAgenda: 15, localTips: 15, emergency: 8 }

/** Contatos mostrados quando a pousada não cadastrou nenhum. */
export const DEFAULT_EMERGENCY: EmergencyContact[] = [
  { label: 'SAMU', phone: '192' },
  { label: 'Bombeiros', phone: '193' },
  { label: 'Polícia', phone: '190' },
]

type ParseResult<T> = { ok: true; items: T[] } | { ok: false; error: string }

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function cells(line: string): string[] {
  return line.split('|').map((c) => c.trim())
}

/** "18h", "18:00", "8h30", "08.30" → "18:00" / "08:30". Inválido → null. */
export function normalizeTime(raw: string): string | null {
  const m = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})\s*(?:[:h.]\s*(\d{2})?)?\s*(?:h)?$/)
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function tooMany(label: string, max: number) {
  return `${label}: no máximo ${max} linhas.`
}

export function parseFacilities(text: string): ParseResult<Facility> {
  const ls = lines(text)
  if (ls.length > LIST_LIMITS.facilities) return { ok: false, error: tooMany('Estrutura', 15) }
  const items: Facility[] = []
  for (const [i, l] of ls.entries()) {
    const [name = '', hours = ''] = cells(l)
    if (name.length < 2) return { ok: false, error: `Estrutura, linha ${i + 1}: falta o nome.` }
    if (name.length > 60 || hours.length > 60)
      return { ok: false, error: `Estrutura, linha ${i + 1}: texto muito longo.` }
    items.push({ name, hours })
  }
  return { ok: true, items }
}

export function parseAgenda(text: string): ParseResult<AgendaItem> {
  const ls = lines(text)
  if (ls.length > LIST_LIMITS.dailyAgenda) return { ok: false, error: tooMany('Agenda', 15) }
  const items: AgendaItem[] = []
  for (const [i, l] of ls.entries()) {
    const [rawTime = '', title = '', note = ''] = cells(l)
    const time = normalizeTime(rawTime)
    if (!time)
      return { ok: false, error: `Agenda, linha ${i + 1}: comece com o horário (ex.: 18:00 | …).` }
    if (title.length < 2) return { ok: false, error: `Agenda, linha ${i + 1}: falta o título.` }
    if (title.length > 60 || note.length > 80)
      return { ok: false, error: `Agenda, linha ${i + 1}: texto muito longo.` }
    items.push({ time, title, note })
  }
  items.sort((a, b) => a.time.localeCompare(b.time))
  return { ok: true, items }
}

export function parseLocalTips(text: string): ParseResult<LocalTip> {
  const ls = lines(text)
  if (ls.length > LIST_LIMITS.localTips) return { ok: false, error: tooMany('Dicas', 15) }
  const items: LocalTip[] = []
  for (const [i, l] of ls.entries()) {
    const [name = '', kind = '', distance = ''] = cells(l)
    if (name.length < 2) return { ok: false, error: `Dicas, linha ${i + 1}: falta o nome.` }
    if (name.length > 60 || kind.length > 40 || distance.length > 20)
      return { ok: false, error: `Dicas, linha ${i + 1}: texto muito longo.` }
    items.push({ name, kind, distance })
  }
  return { ok: true, items }
}

export function parseEmergency(text: string): ParseResult<EmergencyContact> {
  const ls = lines(text)
  if (ls.length > LIST_LIMITS.emergency) return { ok: false, error: tooMany('Emergência', 8) }
  const items: EmergencyContact[] = []
  for (const [i, l] of ls.entries()) {
    const [label = '', phone = ''] = cells(l)
    const digits = phone.replace(/\D/g, '')
    if (label.length < 2) return { ok: false, error: `Emergência, linha ${i + 1}: falta o nome.` }
    if (digits.length < 3 || digits.length > 13 || label.length > 40)
      return { ok: false, error: `Emergência, linha ${i + 1}: telefone inválido.` }
    items.push({ label, phone: phone.slice(0, 20) })
  }
  return { ok: true, items }
}

export const formatFacilities = (xs: Facility[]) =>
  xs.map((x) => [x.name, x.hours].filter(Boolean).join(' | ')).join('\n')
export const formatAgenda = (xs: AgendaItem[]) =>
  xs.map((x) => [x.time, x.title, x.note].filter(Boolean).join(' | ')).join('\n')
export const formatLocalTips = (xs: LocalTip[]) =>
  xs.map((x) => [x.name, x.kind, x.distance].join(' | ').replace(/( \| )+$/, '')).join('\n')
export const formatEmergency = (xs: EmergencyContact[]) =>
  xs.map((x) => `${x.label} | ${x.phone}`).join('\n')

/** Lê uma lista JSON vinda do banco, descartando o que não tiver o formato. */
export function readList<T extends Record<string, string>>(raw: unknown, keys: (keyof T)[]): T[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map(
      (x) =>
        Object.fromEntries(
          keys.map((k) => [k, x[k as string] == null ? '' : String(x[k as string])]),
        ) as T,
    )
    .filter((x) => String(x[keys[0]]).trim().length > 0)
}

/** Situação de cada evento da agenda de hoje: já passou, acontecendo agora ou depois. */
export function agendaState(items: AgendaItem[], nowHHMM: string): ('done' | 'now' | 'next')[] {
  let current = -1
  items.forEach((it, i) => {
    if (it.time <= nowHHMM) current = i
  })
  return items.map((_, i) => (i < current ? 'done' : i === current ? 'now' : 'next'))
}
