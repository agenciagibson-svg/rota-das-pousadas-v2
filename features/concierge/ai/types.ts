export type ChatRole = 'user' | 'assistant'

export type ChatMessage = { role: ChatRole; content: string }

/** Cartão de pousada que o concierge mostra na conversa (dados do catálogo). */
export type ConciergeCard = {
  slug: string
  name: string
  city: string
  state: string
  image: string
  pricePerNight: number
  rating: number
  reviews: number
  tags: string[]
  /** Por que combinou (ex.: "praia", "pets"). */
  reasons: string[]
  capacity: number
  /** Página da pousada, já com datas e hóspedes quando houver. */
  pageHref: string
  /** Direto para a reserva — só quando há datas. */
  reserveHref: string | null
  nights: number | null
  total: number | null
}

export type ConciergeReply = {
  reply: string
  cards: ConciergeCard[]
  quickReplies: string[]
  /** `openai` quando o ChatGPT respondeu; `local` no modo sem chave (ou se a OpenAI falhar). */
  engine: 'openai' | 'local'
  /** Por que o modo local respondeu (`sem_chave`, `openai_401`, `openai_429`…). */
  fallback?: string
}
