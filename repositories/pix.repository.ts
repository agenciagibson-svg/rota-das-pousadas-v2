import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import type { PixKeyType } from '@/lib/pix/brcode'
import type { PaymentReviewKind } from '@/features/pagamentos/pix'

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

export type ReviewProofResult = {
  bookingId: string
  approved: boolean
  confirmed: boolean
  amount: number | null
  remaining: number
}

export async function reviewPaymentProofRpc(input: {
  proofId: string
  approve: boolean
  reason: string | null
  amount?: number | null
}): Promise<ReviewProofResult> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('review_payment_proof', {
    p_proof_id: input.proofId,
    p_approve: input.approve,
    ...(input.reason ? { p_reason: input.reason } : {}),
    ...(input.amount ? { p_amount: input.amount } : {}),
  })
  if (error) throw new Error(error.message)
  const r = data as {
    bookingId: string
    approved: boolean
    confirmed: boolean
    amount?: number | string | null
    remaining?: number | string | null
  }
  return {
    bookingId: r.bookingId,
    approved: r.approved,
    confirmed: r.confirmed,
    amount: r.amount == null ? null : Number(r.amount),
    remaining: Number(r.remaining ?? 0),
  }
}

export type StaffProof = ProofSummary & {
  amount: number
  /** Valor conferido na aprovação (0082); pode ser menor que `amount`. */
  approvedAmount: number | null
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
      'id, status, file_name, file_path, mime_type, amount, approved_amount, created_at, reviewed_at, rejection_reason',
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
    approvedAmount: r.approved_amount == null ? null : Number(r.approved_amount),
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

// ---------------------------------------------------------------------------
// Fila "Pagamentos para revisar" (0082)
// ---------------------------------------------------------------------------
export type { PaymentReviewKind }

export type OpenPaymentReview = {
  id: string
  bookingId: string
  bookingCode: string | null
  kind: PaymentReviewKind
  source: 'pix_direto' | 'mercado_pago'
  amount: number
  createdAt: string
}

export async function listOpenPaymentReviews(pousadaId: string): Promise<OpenPaymentReview[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('payment_reviews')
    .select('id, booking_id, kind, source, amount, created_at, bookings(code)')
    .eq('pousada_id', pousadaId)
    .eq('status', 'aberta')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (
    (data ?? []) as unknown as {
      id: string
      booking_id: string
      kind: PaymentReviewKind
      source: 'pix_direto' | 'mercado_pago'
      amount: number | string
      created_at: string
      bookings: { code: string } | { code: string }[] | null
    }[]
  ).map((r) => {
    const b = Array.isArray(r.bookings) ? r.bookings[0] : r.bookings
    return {
      id: r.id,
      bookingId: r.booking_id,
      bookingCode: b?.code ?? null,
      kind: r.kind,
      source: r.source,
      amount: Number(r.amount),
      createdAt: r.created_at,
    }
  })
}

export type OpenProofDeadline = {
  bookingId: string
  bookingCode: string | null
  amount: number
  dueAt: string | null
}

/** Comprovantes em análise da pousada, com o prazo da reserva (mais urgente primeiro). */
export async function listOpenProofDeadlines(pousadaId: string): Promise<OpenProofDeadline[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('payment_proofs')
    .select('booking_id, amount, bookings(code, payment_due_at)')
    .eq('pousada_id', pousadaId)
    .eq('status', 'submitted')
    .limit(50)
  if (error) throw new Error(error.message)
  return (
    (data ?? []) as unknown as {
      booking_id: string
      amount: number | string
      bookings:
        | { code: string; payment_due_at: string | null }
        | { code: string; payment_due_at: string | null }[]
        | null
    }[]
  )
    .map((r) => {
      const b = Array.isArray(r.bookings) ? r.bookings[0] : r.bookings
      return {
        bookingId: r.booking_id,
        bookingCode: b?.code ?? null,
        amount: Number(r.amount),
        dueAt: b?.payment_due_at ?? null,
      }
    })
    .sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'))
}

export async function resolvePaymentReviewRpc(reviewId: string, resolution: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('resolve_payment_review', {
    p_review_id: reviewId,
    p_resolution: resolution,
  })
  if (error) throw new Error(error.message)
}

/** Cron/webhook: casos novos ainda sem aviso (marca como avisados). Só service_role. */
export async function claimPaymentReviewsToNotify(): Promise<
  { reviewId: string; bookingId: string; kind: PaymentReviewKind; amount: number }[]
> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('claim_payment_reviews_to_notify', {})
  if (error) throw new Error(error.message)
  return (
    (data ?? []) as { review_id: string; booking_id: string; kind: string; amount: number }[]
  ).map((r) => ({
    reviewId: r.review_id,
    bookingId: r.booking_id,
    kind: r.kind as PaymentReviewKind,
    amount: Number(r.amount),
  }))
}
