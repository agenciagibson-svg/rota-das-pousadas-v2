import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { requireCapability } from '@/lib/auth/require-capability'
import { isSupabaseConfigured } from '@/lib/env'
import { sendEmail } from '@/lib/email/mailer'
import { offerEmail } from '@/lib/email/offer-email'
import {
  countOfferAudienceRpc,
  getOfferReportRpc,
  listMyActiveOffersRpc,
  listMyOfferConsentsRpc,
  listOfferEmailsDueRpc,
  markOfferEmailRpc,
  markOfferOpenedRpc,
  sendPousadaOfferRpc,
  setOfferConsentRpc,
  type ActiveOffer,
  type OfferConsent,
  type OfferReportRow,
} from '@/repositories/offers.repository'
import { inOfferSendWindow } from '../rules'
import type { SendOfferData } from '../schemas'

/** Teto de e-mails de oferta por rodada (o SMTP limita envio). */
export const OFFER_EMAILS_PER_RUN = 50

// ---------------------------------------------------------------------------
// Hóspede
// ---------------------------------------------------------------------------
export async function setMyOfferConsent(pousadaId: string, granted: boolean): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login.')
  await setOfferConsentRpc(pousadaId, granted)
}

export async function listMyOfferConsents(): Promise<OfferConsent[]> {
  if (!isSupabaseConfigured()) return []
  const user = await getCurrentUser()
  if (!user) return []
  return listMyOfferConsentsRpc()
}

/** A pessoa autorizou ofertas desta pousada? `null` = sem login ou sem dado. */
export async function myOfferConsentFor(pousadaId: string): Promise<boolean | null> {
  try {
    const consents = await listMyOfferConsents()
    return consents.find((c) => c.pousadaId === pousadaId)?.granted ?? false
  } catch {
    return null
  }
}

export async function listMyActiveOffers(): Promise<ActiveOffer[]> {
  if (!isSupabaseConfigured()) return []
  const user = await getCurrentUser()
  if (!user) return []
  try {
    return await listMyActiveOffersRpc()
  } catch {
    return []
  }
}

/** Hóspede abriu a pousada com o cupom da oferta. Nunca derruba a página. */
export async function markOfferOpened(code: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  const user = await getCurrentUser()
  if (!user) return
  await markOfferOpenedRpc(code).catch(() => {})
}

// ---------------------------------------------------------------------------
// Pousada (dono e gestor)
// ---------------------------------------------------------------------------
export async function getOfferAudience() {
  const { pousadaId } = await requireCapability('coupon:manage')
  return countOfferAudienceRpc(pousadaId)
}

export async function getOfferReport(): Promise<OfferReportRow[]> {
  const { pousadaId } = await requireCapability('coupon:manage')
  return getOfferReportRpc(pousadaId)
}

/**
 * Cria a oferta (cupom de cada ex-hóspede, no banco) e, dentro do horário
 * (8h às 21h de Brasília), já manda os e-mails. Fora dele, a rodada das 10h
 * envia.
 */
export async function sendOffer(
  input: SendOfferData,
  now: Date = new Date(),
): Promise<{ sent: number; emailed: number; queued: boolean }> {
  const { pousadaId } = await requireCapability('coupon:manage')
  const { sent } = await sendPousadaOfferRpc({
    pousadaId,
    percent: input.percent,
    validDays: input.validDays,
    stayFrom: input.stayFrom ?? null,
    stayUntil: input.stayUntil ?? null,
    message: input.message,
  })
  if (sent === 0) return { sent, emailed: 0, queued: false }
  if (!inOfferSendWindow(now)) return { sent, emailed: 0, queued: true }
  const result = await sendDueOfferEmails(OFFER_EMAILS_PER_RUN, now).catch(() => null)
  return { sent, emailed: result?.sent ?? 0, queued: !result || result.sent < sent }
}

// ---------------------------------------------------------------------------
// Rodada de e-mails (cron e envio imediato)
// ---------------------------------------------------------------------------
export async function sendDueOfferEmails(
  limit = OFFER_EMAILS_PER_RUN,
  now: Date = new Date(),
): Promise<{ sent: number; failed: number; skipped?: 'fora_do_horario' }> {
  if (!inOfferSendWindow(now)) return { sent: 0, failed: 0, skipped: 'fora_do_horario' }
  const targets = await listOfferEmailsDueRpc(limit)
  let sent = 0
  let failed = 0
  for (const target of targets) {
    let ok = false
    try {
      ok = await sendEmail({ to: target.email, ...offerEmail(target) })
    } catch (error) {
      // Sem e-mail nem nome no log (LGPD): só o envio e o erro.
      console.error('[ofertas] falha no e-mail', {
        deliveryId: target.deliveryId,
        error: String(error),
      })
    }
    await markOfferEmailRpc(target.deliveryId, ok).catch(() => {})
    if (ok) sent++
    else failed++
  }
  return { sent, failed }
}
