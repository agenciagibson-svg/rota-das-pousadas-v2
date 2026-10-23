/**
 * Avaliação da estadia — regras puras usadas pelo e-mail de pedido (0089), pela
 * página `/minhas-reservas/[id]/avaliar` e pelos testes. Sem I/O.
 */

export const REVIEW_RATINGS = [1, 2, 3, 4, 5] as const
export type ReviewRating = (typeof REVIEW_RATINGS)[number]

/**
 * Nota vinda do link do e-mail (`?nota=N`). Só aceita um inteiro de 1 a 5
 * escrito como um único dígito; qualquer outra coisa (vazio, "0", "6", "4.5",
 * "abc", lista repetida) deixa a página sem estrela pré-selecionada.
 */
export function parseRatingParam(value: string | string[] | null | undefined): ReviewRating | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^[1-5]$/.test(trimmed)) return null
  return Number(trimmed) as ReviewRating
}

/** Caminho da página de avaliação; com nota, já abre com as estrelas marcadas. */
export function reviewPagePath(bookingId: string, rating?: ReviewRating): string {
  const base = `/minhas-reservas/${encodeURIComponent(bookingId)}/avaliar`
  return rating ? `${base}?nota=${rating}` : base
}

/**
 * O que a página mostra:
 * - `available`: pode avaliar agora;
 * - `reviewed`: já avaliou esta estadia;
 * - `not_yet`: a estadia ainda não terminou;
 * - `not_eligible`: reserva que não dá direito a avaliar (balcão, outro canal,
 *   cancelada, feita pela equipe).
 */
export type ReviewAvailability = 'available' | 'reviewed' | 'not_yet' | 'not_eligible'

export function reviewAvailability(s: {
  canReview: boolean
  reviewed: boolean
  status: string
  /** Hoje no fuso da pousada (AAAA-MM-DD). */
  today: string
  checkout: string
}): ReviewAvailability {
  if (s.reviewed) return 'reviewed'
  if (s.canReview) return 'available'
  if (['pending', 'confirmed', 'checked_in'].includes(s.status) && s.today < s.checkout) {
    return 'not_yet'
  }
  return 'not_eligible'
}
