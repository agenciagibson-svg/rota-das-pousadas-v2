import 'server-only'
import type { createSupabaseServerClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>

/**
 * Contato do hóspede para a equipe da pousada (0105).
 *
 * E-mail e telefone não são lidos direto de `bookings`/`guests`: o banco
 * recusa. Reserva feita pelo viajante no site só mostra o contato depois que o
 * pagamento é confirmado; até lá as RPCs devolvem `released = false` e o
 * contato vazio. Ficha cadastrada pela própria pousada sempre vem liberada.
 */

export type BookingContact = {
  released: boolean
  email: string | null
  /** Telefone gravado na reserva. */
  phone: string | null
  /** WhatsApp ou telefone da ficha do hóspede (quando a reserva não tem telefone). */
  guestPhone: string | null
}

export type GuestContact = {
  released: boolean
  email: string | null
  phone: string | null
  whatsapp: string | null
}

const HIDDEN_BOOKING: BookingContact = {
  released: false,
  email: null,
  phone: null,
  guestPhone: null,
}
const HIDDEN_GUEST: GuestContact = { released: false, email: null, phone: null, whatsapp: null }

export async function bookingContactsById(
  supabase: Client,
  bookingIds: string[],
): Promise<Map<string, BookingContact>> {
  const ids = [...new Set(bookingIds.filter(Boolean))]
  const out = new Map<string, BookingContact>()
  if (ids.length === 0) return out
  const { data, error } = await supabase.rpc('get_booking_guest_contacts', { p_booking_ids: ids })
  if (error) throw new Error(error.message)
  for (const r of data ?? []) {
    out.set(r.booking_id, {
      released: r.released === true,
      email: r.email ?? null,
      phone: r.phone ?? null,
      guestPhone: r.guest_phone ?? null,
    })
  }
  return out
}

/** Contato de uma reserva; sem linha (sem acesso) conta como oculto. */
export function bookingContactOf(map: Map<string, BookingContact>, id: string): BookingContact {
  return map.get(id) ?? HIDDEN_BOOKING
}

export async function guestContactsById(
  supabase: Client,
  guestIds: string[],
): Promise<Map<string, GuestContact>> {
  const ids = [...new Set(guestIds.filter(Boolean))]
  const out = new Map<string, GuestContact>()
  if (ids.length === 0) return out
  const { data, error } = await supabase.rpc('get_guest_contacts', { p_guest_ids: ids })
  if (error) throw new Error(error.message)
  for (const r of data ?? []) {
    out.set(r.guest_id, {
      released: r.released === true,
      email: r.email ?? null,
      phone: r.phone ?? null,
      whatsapp: r.whatsapp ?? null,
    })
  }
  return out
}

export function guestContactOf(map: Map<string, GuestContact>, id: string): GuestContact {
  return map.get(id) ?? HIDDEN_GUEST
}

/** Ids de fichas liberadas que batem com o e-mail/telefone (busca parcial). */
export async function searchGuestIdsByContact(
  supabase: Client,
  pousadaId: string,
  filters: { email?: string; phone?: string },
): Promise<string[]> {
  const { data, error } = await supabase.rpc('search_guest_ids_by_contact', {
    p_pousada_id: pousadaId,
    ...(filters.email ? { p_email: filters.email } : {}),
    ...(filters.phone ? { p_phone: filters.phone } : {}),
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as string[]
}
