/**
 * Link de demonstração (0101): página privada que mostra a uma pousada que
 * ainda não é cliente como ela ficaria na Rota, sem publicar nada.
 *
 * O corte do que aparece é do banco (`get_demo_pousada`): só pousada não
 * publicada, só as colunas da vitrine, só acomodações ativas e visíveis.
 * Aqui só se confere a forma do que veio.
 */
import type { Pousada } from '@/types'
import type { PublicRoomInfo } from '@/components/pousada/pousada-sections'

/** Mesmo formato que o banco aceita (0101, gerador da 0094). */
export const DEMO_TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/

export function isDemoToken(value: unknown): value is string {
  return typeof value === 'string' && DEMO_TOKEN_RE.test(value)
}

/** Caminho público do link. */
export function demoPath(token: string): string {
  return `/demo/${token}`
}

/** Texto pronto para mandar no WhatsApp junto com o link. */
export function demoWhatsappText(pousadaName: string, url: string): string {
  return `Olá! Preparei uma demonstração de como a ${pousadaName} ficaria na Rota das Pousadas, com reserva direta e sem comissão: ${url}`
}

export function demoWhatsappHref(pousadaName: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(demoWhatsappText(pousadaName, url))}`
}

/** Link de uma pousada como o /admin mostra (sem o token quando desativado). */
export type DemoLinkInfo = {
  pousadaId: string
  token: string | null
  active: boolean
  createdAt: string
  views: number
  firstViewedAt: string | null
  lastViewedAt: string | null
}

/** "há 5 min", "há 3 h", "há 2 dias" — para a última abertura do link. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'agora há pouco'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}

export type DemoRoomRow = {
  id: string
  name: string
  description: string | null
  base_price: number
  capacity: number
  gallery: string[] | null
}

export type DemoResult =
  | { kind: 'published'; slug: string }
  | { kind: 'demo'; pousadaRow: Record<string, unknown>; rooms: PublicRoomInfo[] }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function toRoom(r: unknown): PublicRoomInfo | null {
  if (!isRecord(r) || typeof r.id !== 'string' || typeof r.name !== 'string') return null
  const price = Number(r.base_price)
  const capacity = Number(r.capacity)
  if (!Number.isFinite(price) || !Number.isFinite(capacity)) return null
  return {
    id: r.id,
    name: r.name,
    description: typeof r.description === 'string' ? r.description : '',
    capacity,
    nightly: price,
    gallery: Array.isArray(r.gallery)
      ? r.gallery.filter((g): g is string => typeof g === 'string')
      : [],
    // A demonstração não cota datas: sem total da estadia e sem mínimo.
    stayTotal: null,
    minNights: 1,
  }
}

/** Lê a resposta de `get_demo_pousada`. `null` = link inexistente, desativado ou inválido. */
export function parseDemoResponse(raw: unknown): DemoResult | null {
  if (!isRecord(raw)) return null
  if (raw.published === true) {
    return typeof raw.slug === 'string' && raw.slug ? { kind: 'published', slug: raw.slug } : null
  }
  if (raw.published !== false || !isRecord(raw.pousada)) return null
  const p = raw.pousada
  if (typeof p.slug !== 'string' || typeof p.name !== 'string') return null
  const rooms = (Array.isArray(raw.rooms) ? raw.rooms : [])
    .map(toRoom)
    .filter((r): r is PublicRoomInfo => r !== null)
  return { kind: 'demo', pousadaRow: p, rooms }
}

/** A pousada da demonstração nunca mostra nota inventada: sem avaliação real, zera. */
export function withoutSeedRating(pousada: Pousada): Pousada {
  return pousada.reviews > 0 ? pousada : { ...pousada, rating: 0, reviews: 0 }
}
