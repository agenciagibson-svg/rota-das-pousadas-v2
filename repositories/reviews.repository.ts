import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseStaticClient } from '@/lib/supabase/static'

export type OwnerReviewRow = {
  id: string
  bookingCode: string
  guestName: string
  guestEmail: string
  rating: number
  text: string
  response: string | null
  checkin: string | null
  checkout: string | null
  createdAt: string
}

export async function listReviewsByPousada(pousadaId: string): Promise<OwnerReviewRow[]> {
  const supabase = await createSupabaseServerClient()
  // Autor e reserva não são públicos (0084): o painel lê pela RPC, que
  // confere se quem pede é da equipe desta pousada (ou da plataforma).
  const { data: reviews, error } = await supabase.rpc('list_pousada_reviews', {
    p_pousada_id: pousadaId,
  })
  if (error) throw error
  if (!reviews || reviews.length === 0) return []

  const authorIds = [...new Set(reviews.map((review) => review.author_id))]
  const bookingIds = [...new Set(reviews.map((review) => review.booking_id))]

  const [{ data: profiles }, { data: bookings }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', authorIds),
    supabase
      .from('bookings')
      .select('id, code, guest_name, guest_email, checkin, checkout')
      .in('id', bookingIds),
  ])

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  const bookingById = new Map((bookings ?? []).map((booking) => [booking.id, booking]))

  return reviews.map((review) => {
    const booking = bookingById.get(review.booking_id)
    const profile = profileById.get(review.author_id)

    return {
      id: review.id,
      bookingCode: booking?.code ?? 'Reserva',
      guestName: booking?.guest_name || profile?.full_name || 'Hóspede',
      guestEmail: booking?.guest_email ?? 'E-mail não informado',
      rating: review.rating,
      text: review.text,
      response: review.response,
      checkin: booking?.checkin ?? null,
      checkout: booking?.checkout ?? null,
      createdAt: review.created_at,
    }
  })
}

export type PublicReviewRow = {
  id: string
  rating: number
  text: string
  response: string | null
  createdAt: string
}

/**
 * Avaliações públicas de uma pousada, para a página de vitrine.
 *
 * RLS `reviews_public_read` (migration 0002) já libera `select` pra
 * qualquer um — leitura anônima, cliente sem sessão (mesmo padrão de
 * `listSlugs` em `pousadas.repository.ts`). NUNCA junta com `profiles`
 * (não é público, RLS `profiles_self_select`) nem com `bookings` (também
 * protegida) pra pegar nome do hóspede — o dado de quem escreveu a
 * avaliação não é pra sair na vitrine sem o consentimento explícito dele,
 * então a avaliação pública sai sem nome, só nota + texto + resposta da
 * pousada + data.
 */
export async function listPublicReviewsByPousada(
  pousadaId: string,
  limit = 6,
): Promise<PublicReviewRow[]> {
  const supabase = createSupabaseStaticClient()
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, text, response, created_at')
    .eq('pousada_id', pousadaId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    response: r.response,
    createdAt: r.created_at,
  }))
}

export async function updateReviewResponseByPousada(
  pousadaId: string,
  reviewId: string,
  response: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('reviews')
    .update({ response })
    .eq('id', reviewId)
    .eq('pousada_id', pousadaId)
  if (error) throw error
}
