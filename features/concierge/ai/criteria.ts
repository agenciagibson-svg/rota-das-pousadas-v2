import { normalizeSearch } from '../recommendations'

/**
 * Lê o que a pessoa escreveu no concierge e transforma em critérios de busca:
 * intenções (praia, resort, cabana, família, pets, floresta, verão…), número
 * de pessoas, datas, orçamento e região. Usado pelo concierge local (sem
 * chave da OpenAI) e para sugerir respostas rápidas também no modo ChatGPT.
 */

export type IntentKey =
  | 'praia'
  | 'resort'
  | 'piscina'
  | 'cabana'
  | 'familia'
  | 'pets'
  | 'floresta'
  | 'natureza'
  | 'verao'
  | 'inverno'
  | 'romantico'
  | 'serra'
  | 'cachoeira'
  | 'fazenda'
  | 'luxo'
  | 'aventura'
  | 'glamping'
  | 'lareira'
  | 'descanso'
  | 'gastronomia'

/**
 * Cada intenção: o rótulo para mostrar, as palavras que a disparam no texto
 * da pessoa e as palavras que procuramos no texto da pousada (nome, cidade,
 * descrição e destaques). Tudo sem acento e em minúsculas.
 */
export const INTENTS: Record<IntentKey, { label: string; triggers: string[]; match: string[] }> = {
  praia: {
    label: 'praia',
    triggers: [
      'praia',
      'praias',
      'mar',
      'litoral',
      'pe na areia',
      'beira mar',
      'beira-mar',
      'ilha',
      'ilhas',
      'surf',
      'mergulho',
      'snorkel',
    ],
    match: ['praia', 'mar', 'pe na areia', 'vista mar', 'oceano', 'piscinas naturais', 'baia'],
  },
  resort: {
    label: 'resort',
    triggers: ['resort', 'resorts', 'all inclusive', 'tudo incluso', 'tudo incluido', 'clube'],
    match: ['resort', 'clube infantil', 'borda infinita', 'incluidos'],
  },
  piscina: {
    label: 'piscina',
    triggers: ['piscina', 'piscinas', 'borda infinita', 'piscina aquecida'],
    match: ['piscina'],
  },
  cabana: {
    label: 'cabana',
    triggers: [
      'cabana',
      'cabanas',
      'cabaninha',
      'chale',
      'chales',
      'bangalo',
      'bangalos',
      'casinha',
    ],
    match: ['cabana', 'cabanas', 'chale', 'chales', 'bangalo', 'bangalos'],
  },
  familia: {
    label: 'família',
    triggers: [
      'familia',
      'familias',
      'crianca',
      'criancas',
      'filho',
      'filhos',
      'filha',
      'filhas',
      'kids',
      'infantil',
      'bebe',
    ],
    match: ['familia', 'familias', 'criancas', 'clube infantil', 'fazenda'],
  },
  pets: {
    label: 'pets',
    triggers: [
      'pet',
      'pets',
      'cachorro',
      'cachorros',
      'cachorra',
      'cao',
      'caes',
      'gato',
      'gatos',
      'cachorrinho',
      'bicho',
      'animal de estimacao',
    ],
    match: ['pet friendly', 'pets', 'cachorro', 'bichos de estimacao'],
  },
  floresta: {
    label: 'floresta',
    triggers: [
      'floresta',
      'florestas',
      'mata',
      'selva',
      'amazonia',
      'amazonica',
      'amazonas',
      'arvores',
      'mato',
    ],
    match: ['floresta', 'mata', 'amazonica', 'araucarias', 'igapos'],
  },
  natureza: {
    label: 'natureza',
    triggers: ['natureza', 'verde', 'ecoturismo', 'eco', 'sustentavel', 'passaros'],
    match: ['natureza', 'ecoturismo', 'floresta', 'trilhas', 'mata'],
  },
  verao: {
    label: 'verão',
    triggers: ['verao', 'calor', 'sol', 'ferias de verao', 'dezembro', 'janeiro', 'fevereiro'],
    match: ['praia', 'piscina', 'cachoeiras', 'verao', 'mar'],
  },
  inverno: {
    label: 'inverno',
    triggers: ['inverno', 'frio', 'friozinho', 'geada', 'neve', 'junho', 'julho'],
    match: ['inverno', 'lareira', 'serra', 'geada', 'fondue'],
  },
  romantico: {
    label: 'romântico',
    triggers: [
      'romantico',
      'romantica',
      'romance',
      'lua de mel',
      'casal',
      'a dois',
      'namorada',
      'namorado',
      'esposa',
      'marido',
      'aniversario de casamento',
      'pedido de casamento',
    ],
    match: ['romanticos', 'romantico', 'casais', 'casal', 'lareira', 'banheira', 'ofuro'],
  },
  serra: {
    label: 'serra',
    triggers: ['serra', 'serras', 'montanha', 'montanhas', 'mantiqueira', 'altitude'],
    match: ['serra', 'montanha', 'mantiqueira', 'araucarias', 'vale'],
  },
  cachoeira: {
    label: 'cachoeira',
    triggers: ['cachoeira', 'cachoeiras', 'rio', 'rios', 'fervedouro', 'cascata'],
    match: ['cachoeira', 'cachoeiras', 'rio', 'fervedouros'],
  },
  fazenda: {
    label: 'fazenda',
    triggers: ['fazenda', 'roca', 'campo', 'cavalo', 'cavalgada', 'interior', 'sitio'],
    match: ['fazenda', 'cavalgada', 'campo', 'horta'],
  },
  luxo: {
    label: 'luxo',
    triggers: [
      'luxo',
      'luxuoso',
      'luxuosa',
      'sofisticado',
      'sofisticada',
      'premium',
      'cinco estrelas',
      '5 estrelas',
      'chique',
    ],
    match: ['luxo', 'premium', 'sofisticacao', 'alto padrao', 'autoral'],
  },
  aventura: {
    label: 'aventura',
    triggers: [
      'aventura',
      'trilha',
      'trilhas',
      'radical',
      'rapel',
      'dunas',
      'canoa',
      'caiaque',
      'passeio de barco',
    ],
    match: ['aventura', 'trilhas', 'dunas', 'canoa', 'catamara', 'roteiros guiados'],
  },
  glamping: {
    label: 'glamping',
    triggers: ['glamping', 'acampar', 'camping', 'barraca'],
    match: ['glamping', 'lona'],
  },
  lareira: {
    label: 'lareira',
    triggers: ['lareira', 'fondue', 'vinho', 'vinhos', 'aconchego', 'aconchegante'],
    match: ['lareira', 'fondue', 'vinho'],
  },
  descanso: {
    label: 'descanso',
    triggers: [
      'descanso',
      'descansar',
      'relaxar',
      'silencio',
      'sossego',
      'desconectar',
      'spa',
      'bem estar',
      'bem-estar',
      'paz',
    ],
    match: ['descanso', 'silencio', 'banheira', 'spa', 'ofuro', 'contemplacao'],
  },
  gastronomia: {
    label: 'gastronomia',
    triggers: [
      'gastronomia',
      'comida',
      'cafe da manha',
      'cafe colonial',
      'culinaria',
      'restaurante',
    ],
    match: ['cafe', 'gastronomia', 'restaurante', 'quitandas', 'frutos do mar', 'autoral'],
  },
}

const STATE_NAMES: Record<string, string[]> = {
  'minas gerais': ['MG'],
  minas: ['MG'],
  mineiro: ['MG'],
  mineira: ['MG'],
  bahia: ['BA'],
  baiano: ['BA'],
  baiana: ['BA'],
  alagoas: ['AL'],
  pernambuco: ['PE'],
  ceara: ['CE'],
  'rio grande do norte': ['RN'],
  'santa catarina': ['SC'],
  catarinense: ['SC'],
  'rio grande do sul': ['RS'],
  gaucho: ['RS'],
  parana: ['PR'],
  'rio de janeiro': ['RJ'],
  'sao paulo': ['SP'],
  'espirito santo': ['ES'],
  amazonas: ['AM'],
  para: ['PA'],
  tocantins: ['TO'],
  goias: ['GO'],
  'mato grosso': ['MT'],
  'mato grosso do sul': ['MS'],
  nordeste: ['BA', 'AL', 'PE', 'CE', 'RN'],
  sul: ['SC', 'RS', 'PR'],
  sudeste: ['MG', 'RJ', 'SP', 'ES'],
  norte: ['AM', 'PA', 'TO'],
  'centro-oeste': ['GO', 'MT', 'MS', 'DF'],
}

const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
}
const NUM = '(\\d{1,2}|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)'

function toNumber(token: string): number {
  return /^\d+$/.test(token) ? Number(token) : (NUMBER_WORDS[token] ?? NaN)
}

function hasWord(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text)
}

export type Criteria = {
  intents: IntentKey[]
  guests: number | null
  dates: { checkin: string; checkout: string } | null
  nights: number | null
  maxPrice: number | null
  states: string[]
  /** Todo o texto da pessoa, normalizado (para achar cidades e nomes no catálogo). */
  text: string
}

function guestsIn(text: string): number | null {
  let adults = 0
  let kids = 0
  let found = false
  for (const m of text.matchAll(new RegExp(`${NUM}\\s*(adultos?|pessoas?|hospedes?)`, 'g'))) {
    adults += toNumber(m[1]!)
    found = true
  }
  for (const m of text.matchAll(
    new RegExp(`${NUM}\\s*(criancas?|filhos?|filhas?|kids|bebes?)`, 'g'),
  )) {
    kids += toNumber(m[1]!)
    found = true
  }
  if (found) return adults + kids || null
  const group = text.match(
    new RegExp(`(?:somos|seremos|vamos em|vamos ser|familia de|grupo de|em)\\s+${NUM}(?![\\d/])`),
  )
  if (group) {
    const n = toNumber(group[1]!)
    if (n > 0) return n
  }
  if (
    /(^|\s)(casal|a dois|minha esposa|meu marido|minha namorada|meu namorado|eu e (minha|meu) \w+)/.test(
      text,
    )
  )
    return 2
  if (/(sozinh[oa]|so eu)/.test(text)) return 1
  return null
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
const MONTHS_RE = MONTHS.join('|')

/** Dia/mês sem ano: o próximo que ainda não passou. */
function resolveDate(
  day: number,
  month: number,
  year: number | null,
  today: string,
): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const todayYear = Number(today.slice(0, 4))
  let y = year == null ? todayYear : year < 100 ? 2000 + year : year
  let iso = `${y}-${pad(month)}-${pad(day)}`
  if (year == null && iso < today) {
    y += 1
    iso = `${y}-${pad(month)}-${pad(day)}`
  }
  const parsed = new Date(`${iso}T12:00:00Z`)
  return parsed.toISOString().slice(0, 10) === iso ? iso : null
}

function datesIn(text: string, today: string): { checkin: string; checkout: string | null } | null {
  const range = text.match(
    /(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{2,4}))?)?\s*(?:a|ate|-|ao)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
  )
  if (range) {
    const endMonth = Number(range[5])
    const endYear = range[6] ? Number(range[6]) : null
    const startMonth = range[2] ? Number(range[2]) : endMonth
    const startYear = range[3] ? Number(range[3]) : endYear
    const checkin = resolveDate(Number(range[1]), startMonth, startYear, today)
    let checkout = resolveDate(Number(range[4]), endMonth, endYear, today)
    if (checkin && checkout && checkout <= checkin) {
      checkout = resolveDate(Number(range[4]), endMonth, Number(checkin.slice(0, 4)) + 1, today)
    }
    if (checkin && checkout) return { checkin, checkout }
  }
  // "20 a 23 de novembro", "28 de dezembro a 2 de janeiro".
  const named = text.match(
    new RegExp(
      `(\\d{1,2})\\s*(?:de\\s+(${MONTHS_RE})\\s*)?(?:a|ate|-|ao)\\s*(?:dia\\s+)?(\\d{1,2})\\s*de\\s+(${MONTHS_RE})`,
    ),
  )
  if (named) {
    const endMonth = MONTHS.indexOf(named[4]!) + 1
    const startMonth = named[2] ? MONTHS.indexOf(named[2]) + 1 : endMonth
    const checkin = resolveDate(Number(named[1]), startMonth, null, today)
    let checkout = resolveDate(Number(named[3]), endMonth, null, today)
    if (checkin && checkout && checkout <= checkin) {
      checkout = resolveDate(Number(named[3]), endMonth, Number(checkin.slice(0, 4)) + 1, today)
    }
    if (checkin && checkout) return { checkin, checkout }
  }
  const namedSingle = text.match(new RegExp(`(\\d{1,2})\\s*de\\s+(${MONTHS_RE})`))
  if (namedSingle) {
    const checkin = resolveDate(
      Number(namedSingle[1]),
      MONTHS.indexOf(namedSingle[2]!) + 1,
      null,
      today,
    )
    if (checkin) return { checkin, checkout: null }
  }
  const single = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (single) {
    const checkin = resolveDate(
      Number(single[1]),
      Number(single[2]),
      single[3] ? Number(single[3]) : null,
      today,
    )
    if (checkin) return { checkin, checkout: null }
  }
  if (/(fim|final) de semana/.test(text)) {
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay()
    const friday = addDays(today, (5 - dow + 7) % 7)
    return { checkin: friday, checkout: addDays(friday, 2) }
  }
  return null
}

function nightsIn(text: string): number | null {
  const m = text.match(new RegExp(`${NUM}\\s*(noites?|diarias?|dias)`))
  if (!m) return null
  const n = toNumber(m[1]!)
  if (!Number.isFinite(n) || n < 1) return null
  return m[2]!.startsWith('dia') && !m[2]!.startsWith('diaria') ? Math.max(1, n - 1) : n
}

function maxPriceIn(text: string): number | null {
  const m =
    text.match(
      /(?:ate|no maximo|maximo|max|teto de|uns|umas)\s*(?:r\$)?\s*(\d{2,3}(?:[.\s]?\d{3})*)/,
    ) ?? text.match(/r\$\s*(\d{2,3}(?:[.\s]?\d{3})*)/)
  if (m) {
    const value = Number(m[1]!.replace(/[.\s]/g, ''))
    if (value >= 50) return value
  }
  if (/(barat|economic|em conta|orcamento curto|nao muito caro)/.test(text)) return 450
  return null
}

/** Junta tudo o que a pessoa disse; a mensagem mais recente vence em pessoas, datas e orçamento. */
export function extractCriteria(userMessages: string[], today: string): Criteria {
  const texts = userMessages.map(normalizeSearch)
  const all = texts.join(' \n ')
  const intents = (Object.keys(INTENTS) as IntentKey[]).filter((key) =>
    INTENTS[key].triggers.some((t) => hasWord(all, t)),
  )

  let guests: number | null = null
  let start: { checkin: string; checkout: string | null } | null = null
  let nights: number | null = null
  let maxPrice: number | null = null
  for (const text of texts) {
    guests = guestsIn(text) ?? guests
    start = datesIn(text, today) ?? start
    nights = nightsIn(text) ?? nights
    maxPrice = maxPriceIn(text) ?? maxPrice
  }

  let dates: Criteria['dates'] = null
  if (start?.checkout) dates = { checkin: start.checkin, checkout: start.checkout }
  else if (start && nights)
    dates = { checkin: start.checkin, checkout: addDays(start.checkin, nights) }

  const states = new Set<string>()
  for (const [name, ufs] of Object.entries(STATE_NAMES)) {
    if (hasWord(all, name)) ufs.forEach((uf) => states.add(uf))
  }
  // "minas" já cobre "minas gerais"; "mato grosso do sul" não deve trazer MT.
  if (hasWord(all, 'mato grosso do sul')) states.delete('MT')
  if (hasWord(all, 'rio grande do sul') || hasWord(all, 'rio grande do norte')) states.delete('RJ')

  return { intents, guests, dates, nights, maxPrice, states: [...states], text: all }
}

export function nightsBetween(checkin: string, checkout: string): number {
  return Math.round(
    (new Date(`${checkout}T12:00:00Z`).getTime() - new Date(`${checkin}T12:00:00Z`).getTime()) /
      86_400_000,
  )
}
