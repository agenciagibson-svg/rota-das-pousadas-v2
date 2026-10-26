import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

/**
 * Fichas antigas completadas pelo perfil do viajante (0097). Mesmo padrão do
 * backfill da 0058: service_role chamando só RPC estreita — nada de ler ou
 * gravar `guests`/`traveler_profiles` direto.
 */

export type PendingGuestBackfill = {
  guestId: string
  /** Campos vazios da ficha que o perfil tem (nomes de coluna, sem valores). */
  fields: string[]
  /** Documento do perfil, CIFRADO (só quando `fields` inclui `document`). */
  profileDocumentNumber: string | null
  profileDocumentNumberHash: string | null
}

type PendingRow = {
  guest_id: string
  fields: string[] | null
  profile_document_number: string | null
  profile_document_number_hash: string | null
}

/** Próxima página de fichas pendentes depois de `after` (ordem por id). */
export async function listGuestsPendingProfileBackfillRpc(
  after: string | null,
  limit: number,
): Promise<PendingGuestBackfill[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('list_guests_pending_profile_backfill', {
    ...(after ? { p_after: after } : {}),
    p_limit: limit,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as PendingRow[]).map((r) => ({
    guestId: r.guest_id,
    fields: r.fields ?? [],
    profileDocumentNumber: r.profile_document_number,
    profileDocumentNumberHash: r.profile_document_number_hash,
  }))
}

export type BackfillDocument = { number: string; hash: string; last4: string }

/** Completa a ficha (só campos vazios). Devolve os campos preenchidos. */
export async function applyGuestProfileBackfillRpc(
  guestId: string,
  document: BackfillDocument | null,
): Promise<string[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('apply_guest_profile_backfill', {
    p_guest_id: guestId,
    ...(document
      ? {
          p_document_number: document.number,
          p_document_number_hash: document.hash,
          p_document_last4: document.last4,
        }
      : {}),
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as string[]
}
