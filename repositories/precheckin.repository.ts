import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { orNull } from '@/lib/supabase/rpc-args'
import type { PrecheckinSnapshot } from '@/features/reservas/precheckin'

/**
 * Pré-check-in online (0088). Sempre com a sessão do próprio hóspede: as duas
 * RPCs conferem no banco que a reserva E a ficha responsável são da conta
 * logada. O documento chega aqui já cifrado (o service cifra); a leitura
 * nunca traz o valor cifrado, só tipo + 4 últimos.
 */

export async function getMyPrecheckinRpc(bookingId: string): Promise<PrecheckinSnapshot | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_my_precheckin', { p_booking_id: bookingId })
  if (error) throw new Error(error.message)
  return (data as PrecheckinSnapshot | null) ?? null
}

export type SubmitPrecheckinParams = {
  bookingId: string
  phone: string
  birthDate: string
  nationality: 'Brasileira' | 'Estrangeira'
  country: string | null
  city: string
  state: string | null
  address: string
  cep: string | null
  /** `null` = manter o documento já salvo na ficha. */
  document: {
    type: 'CPF' | 'Passaporte'
    encrypted: string
    hash: string
    last4: string
  } | null
  companions: {
    fullName: string
    guestType: 'adult' | 'child' | 'infant'
    birthDate: string | null
    documentType: string | null
    /** Já cifrado. */
    documentNumber: string | null
    keepDocumentOf: string | null
    /** Linha antiga do acompanhante (anotações da equipe continuam). */
    previousId: string | null
  }[]
  expectedArrivalTime: string | null
}

export async function submitPrecheckinRpc(p: SubmitPrecheckinParams): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('submit_precheckin', {
    p_booking_id: p.bookingId,
    p_phone: p.phone,
    p_birth_date: p.birthDate,
    p_nationality: p.nationality,
    p_country: orNull(p.country),
    p_city: p.city,
    p_state: orNull(p.state),
    p_address: p.address,
    p_cep: orNull(p.cep),
    p_document_type: orNull(p.document?.type ?? null),
    p_document_number: orNull(p.document?.encrypted ?? null),
    p_document_number_hash: orNull(p.document?.hash ?? null),
    p_document_last4: orNull(p.document?.last4 ?? null),
    p_companions: p.companions,
    p_expected_arrival_time: orNull(p.expectedArrivalTime),
  })
  if (error) throw new Error(error.message)
}
