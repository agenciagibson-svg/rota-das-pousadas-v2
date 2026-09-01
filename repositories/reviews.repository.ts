import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, booking_id, author_id, rating, text, response, created_at')
    .eq('pousada_id', pousadaId)
    .order('created_at', { ascending: false })
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
