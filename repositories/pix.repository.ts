import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import type { PixKeyType } from '@/lib/pix/brcode'

/** Pix direto (0075). Tudo com a sessão do usuário — RLS/RPCs decidem quem pode o quê. */

export type PixSettings = {
  keyType: PixKeyType
  pixKey: string
  holderName: string
  city: string
  enabled: boolean
}

export async function getPixSettingsForPousada(pousadaId: string): Promise<PixSettings | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousada_pix_settings')
    .select('key_type, pix_key, holder_name, city, enabled')
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    keyType: data.key_type as PixKeyType,
    pixKey: data.pix_key,
    holderName: data.holder_name,
    city: data.city,
    enabled: data.enabled,
  }
}

export async function savePixSettingsRpc(pousadaId: string, s: PixSettings): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('save_pousada_pix_settings', {
    p_pousada_id: pousadaId,
    p_key_type: s.keyType,
    p_pix_key: s.pixKey,
    p_holder_name: s.holderName,
    p_city: s.city,
    p_enabled: s.enabled,
  })
  if (error) throw new Error(error.message)
}

export type ProofSummary = {
  id: string
  status: 'submitted' | 'approved' | 'rejected'
  fileName: string
  createdAt: string
  rejectionReason: string | null
}

export type BookingPixInstructions = {
  enabled: boolean
  keyType: PixKeyType | null
  pixKey: string | null
  holderName: string | null
  city: string | null
  lastProof: ProofSummary | null
}

export async function getBookingPixInstructionsRpc(
  bookingId: string,
): Promise<BookingPixInstructions | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_booking_pix_instructions', {
    p_booking_id: bookingId,
  })
  if (error) throw new Error(error.message)
  return (data as BookingPixInstructions | null) ?? null
}

export async function submitPaymentProofRpc(input: {
  bookingId: string
  filePath: string
  fileName: string
  mimeType: string
  sizeBytes: number
}): Promise<{ id: string; amount: number }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('submit_payment_proof', {
    p_booking_id: input.bookingId,
    p_file_path: input.filePath,
    p_file_name: input.fileName,
    p_mime_type: input.mimeType,
    p_size_bytes: input.sizeBytes,
  })
  if (error) throw new Error(error.message)
  const result = data as { id: string; amount: number }
  return { id: result.id, amount: Number(result.amount) }
}

export async function reviewPaymentProofRpc(input: {
  proofId: string
  approve: boolean
  reason: string | null
}): Promise<{ bookingId: string; approved: boolean; confirmed: boolean }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('review_payment_proof', {
    p_proof_id: input.proofId,
    p_approve: input.approve,
    ...(input.reason ? { p_reason: input.reason } : {}),
  })
  if (error) throw new Error(error.message)
  return data as { bookingId: string; approved: boolean; confirmed: boolean }
}

export type StaffProof = ProofSummary & {
  amount: number
  mimeType: string
  reviewedAt: string | null
  /** Link temporário (10 min) para ver o arquivo. */
  url: string | null
}

/** Comprovantes de uma reserva para a equipe (RLS: só quem tem acesso operacional). */
export async function listProofsForBooking(bookingId: string): Promise<StaffProof[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('payment_proofs')
    .select(
      'id, status, file_name, file_path, mime_type, amount, created_at, reviewed_at, rejection_reason',
    )
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const urls = await Promise.all(
    rows.map(async (r) => {
      const { data: signed } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(r.file_path, 600)
      return signed?.signedUrl ?? null
    }),
  )
  return rows.map((r, i) => ({
    id: r.id,
    status: r.status,
    fileName: r.file_name,
    createdAt: r.created_at,
    rejectionReason: r.rejection_reason,
    amount: Number(r.amount),
    mimeType: r.mime_type,
    reviewedAt: r.reviewed_at,
    url: urls[i] ?? null,
  }))
}

/** Reservas da pousada com comprovante esperando análise (para o selo na lista). */
export async function listBookingIdsWithOpenProof(pousadaId: string): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('payment_proofs')
    .select('booking_id')
    .eq('pousada_id', pousadaId)
    .eq('status', 'submitted')
  if (error) return new Set()
  return new Set((data ?? []).map((r) => r.booking_id))
}

/** Reservas do hóspede logado com comprovante em análise (RLS: uploaded_by = ele). */
export async function listMyBookingIdsAwaitingApproval(bookingIds: string[]): Promise<Set<string>> {
  if (bookingIds.length === 0) return new Set()
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('payment_proofs')
    .select('booking_id')
    .in('booking_id', bookingIds)
    .eq('status', 'submitted')
  if (error) return new Set()
  return new Set((data ?? []).map((r) => r.booking_id))
}

/** E-mails de aviso da pousada (notificação + equipe). Só servidor, via service_role. */
export async function getPousadaAlertEmails(bookingId: string): Promise<string[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('get_pousada_alert_emails', {
    p_booking_id: bookingId,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean)
}
