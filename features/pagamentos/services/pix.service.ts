import 'server-only'
import QRCode from 'qrcode'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import { buildPixCopiaECola } from '@/lib/pix/brcode'
import { sendEmail } from '@/lib/email/mailer'
import {
  paymentPartialEmail,
  paymentProofAlertEmail,
  paymentProofReceivedEmail,
  paymentProofRejectedEmail,
  paymentReviewAlertEmail,
} from '@/lib/email/templates'
import { getBookingNotificationContextRpc } from '@/repositories/bookings.repository'
import {
  claimPaymentReviewsToNotify,
  getBookingPixInstructionsRpc,
  listOpenPaymentReviews,
  listOpenProofDeadlines,
  resolvePaymentReviewRpc,
  type OpenPaymentReview,
  type OpenProofDeadline,
  getPixSettingsForPousada,
  getPousadaAlertEmails,
  listProofsForBooking,
  reviewPaymentProofRpc,
  savePixSettingsRpc,
  submitPaymentProofRpc,
  type PixSettings,
  type ProofSummary,
  type StaffProof,
} from '@/repositories/pix.repository'
import { requireCapability } from './access'
import { notifyBookingConfirmed } from './webhook.service'
import type {
  PixSettingsInput,
  ResolveReviewInput,
  ReviewProofInput,
  SubmitProofInput,
} from '../pix'

// ---------------------------------------------------------------------------
// Pousada: configurar a chave
// ---------------------------------------------------------------------------

export async function getOwnerPixSettings(): Promise<{
  settings: PixSettings | null
  canEdit: boolean
} | null> {
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) return null
  const role = await getActiveTenantRole()
  if (!role || !can(role, 'payment:register')) return null
  const settings = await getPixSettingsForPousada(pousadaId)
  return { settings, canEdit: can(role, 'payment:connect_account') }
}

export async function saveOwnerPixSettings(input: PixSettingsInput): Promise<void> {
  const { pousadaId } = await requireCapability('payment:connect_account')
  await savePixSettingsRpc(pousadaId, input)
}

// ---------------------------------------------------------------------------
// Hóspede: pagar e enviar comprovante
// ---------------------------------------------------------------------------

export type PixPayment = {
  /** A pousada recebe Pix direto agora (chave cadastrada e ativa). */
  available: boolean
  copiaECola: string | null
  qrSvg: string | null
  keyType: PixSettings['keyType'] | null
  pixKey: string | null
  holderName: string | null
  amount: number
  lastProof: ProofSummary | null
}

/**
 * Dados do Pix direto para a reserva do hóspede logado (a RPC confere que a
 * reserva é dele). `null` = nada a mostrar (pousada sem Pix e sem comprovante).
 */
export async function getPixPaymentForBooking(booking: {
  id: string
  code: string
  balanceDue: number
}): Promise<PixPayment | null> {
  const info = await getBookingPixInstructionsRpc(booking.id)
  if (!info) return null
  const available = Boolean(info.enabled && info.pixKey && info.keyType && info.holderName)
  if (!available && !info.lastProof) return null

  let copiaECola: string | null = null
  let qrSvg: string | null = null
  if (available && booking.balanceDue > 0 && info.keyType && info.pixKey && info.holderName) {
    copiaECola = buildPixCopiaECola({
      keyType: info.keyType,
      key: info.pixKey,
      merchantName: info.holderName,
      merchantCity: info.city ?? '',
      amount: booking.balanceDue,
      txid: booking.code,
    })
    qrSvg = await QRCode.toString(copiaECola, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#1f2420', light: '#ffffff' },
    })
  }
  return {
    available,
    copiaECola,
    qrSvg,
    keyType: info.keyType,
    pixKey: info.pixKey,
    holderName: info.holderName,
    amount: booking.balanceDue,
    lastProof: info.lastProof,
  }
}

export async function submitPaymentProof(input: SubmitProofInput): Promise<void> {
  const { amount } = await submitPaymentProofRpc(input)
  // Avisos: nunca derrubam o envio (o comprovante já foi registrado).
  try {
    const ctx = await getBookingNotificationContextRpc(input.bookingId)
    if (!ctx) return
    const tasks: Promise<unknown>[] = []
    if (ctx.guestEmail) {
      tasks.push(sendEmail({ to: ctx.guestEmail, ...paymentProofReceivedEmail(ctx, amount) }))
    }
    const staff = await getPousadaAlertEmails(input.bookingId)
    const alert = paymentProofAlertEmail(ctx, amount)
    for (const to of staff) tasks.push(sendEmail({ to, ...alert }))
    await Promise.all(tasks)
  } catch (error) {
    console.error('[pix] falha ao avisar sobre comprovante', {
      bookingId: input.bookingId,
      error: String(error),
    })
  }
}

// ---------------------------------------------------------------------------
// Equipe: conferir e decidir
// ---------------------------------------------------------------------------

export async function listBookingProofsForStaff(bookingId: string): Promise<StaffProof[]> {
  const pousadaId = await getActivePousadaId()
  const role = await getActiveTenantRole()
  if (!pousadaId || !role || !can(role, 'payment:register')) return []
  return listProofsForBooking(bookingId)
}

export async function reviewPaymentProof(input: ReviewProofInput): Promise<{ bookingId: string }> {
  await requireCapability('payment:register')
  const result = await reviewPaymentProofRpc({
    proofId: input.proofId,
    approve: input.approve,
    reason: input.approve ? null : input.reason,
    amount: input.approve ? (input.amount ?? null) : null,
  })
  try {
    if (result.approved && result.confirmed) {
      await notifyBookingConfirmed(result.bookingId)
    } else if (result.approved && result.remaining > 0 && result.amount) {
      const ctx = await getBookingNotificationContextRpc(result.bookingId)
      if (ctx?.guestEmail) {
        await sendEmail({
          to: ctx.guestEmail,
          ...paymentPartialEmail(ctx, result.amount, result.remaining),
        })
      }
    } else if (!result.approved) {
      const ctx = await getBookingNotificationContextRpc(result.bookingId)
      if (ctx?.guestEmail) {
        await sendEmail({ to: ctx.guestEmail, ...paymentProofRejectedEmail(ctx, input.reason) })
      }
    }
  } catch (error) {
    console.error('[pix] falha ao avisar o hóspede', {
      bookingId: result.bookingId,
      error: String(error),
    })
  }
  return { bookingId: result.bookingId }
}

// ---------------------------------------------------------------------------
// Pagamentos para revisar (0082)
// ---------------------------------------------------------------------------

export type PaymentAlerts = {
  reviews: OpenPaymentReview[]
  openProofs: OpenProofDeadline[]
  /** Proprietário/administrador: pode marcar o caso como resolvido. */
  canResolve: boolean
}

/** Alertas de dinheiro para a Visão geral. `null` = papel sem acesso a pagamentos. */
export async function getPaymentAlerts(): Promise<PaymentAlerts | null> {
  const pousadaId = await getActivePousadaId()
  const role = await getActiveTenantRole()
  if (!pousadaId || !role || !can(role, 'payment:register')) return null
  const [reviews, openProofs] = await Promise.all([
    listOpenPaymentReviews(pousadaId),
    listOpenProofDeadlines(pousadaId),
  ])
  return { reviews, openProofs, canResolve: can(role, 'pousada:edit') }
}

export async function resolvePaymentReview(input: ResolveReviewInput): Promise<void> {
  await requireCapability('pousada:edit')
  await resolvePaymentReviewRpc(input.reviewId, input.resolution)
}

/**
 * Avisa a equipe das pousadas sobre casos novos na fila. Chamada pelo cron
 * diário e logo depois de cada webhook do Mercado Pago. Nunca lança.
 */
export async function notifyPaymentReviews(): Promise<{ notified: number }> {
  let notified = 0
  try {
    const items = await claimPaymentReviewsToNotify()
    for (const item of items) {
      try {
        const ctx = await getBookingNotificationContextRpc(item.bookingId)
        if (!ctx) continue
        const staff = await getPousadaAlertEmails(item.bookingId)
        const email = paymentReviewAlertEmail(ctx, item.kind, item.amount)
        await Promise.all(staff.map((to) => sendEmail({ to, ...email })))
        notified += 1
      } catch (error) {
        console.error('[pix] falha ao avisar caso de revisão', {
          reviewId: item.reviewId,
          error: String(error),
        })
      }
    }
  } catch (error) {
    console.error('[pix] falha ao buscar casos de revisão', { error: String(error) })
  }
  return { notified }
}
