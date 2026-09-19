import 'server-only'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can, type Action } from '@/lib/auth/rbac'
import { verifyTurnstileToken } from '@/lib/turnstile'
import {
  createQuoteRequestRpc,
  getLinkReportRpc,
  listQuoteRequestsByPousada,
  setQuoteRequestStatusRpc,
} from '@/repositories/bio.repository'
import type { QuoteRequestInput, QuoteStatusInput, ReportRangeInput } from '../schemas'
import type { LinkReport, QuoteRequest } from '../types'

/**
 * Primeira barreira do painel. `link:report:view` e `quote:manage` espelham
 * `auth_has_guest_access` da 0030, que é o que a RLS da 0046 usa — as duas
 * precisam concordar.
 */
async function requireCapability(action: Action): Promise<{ pousadaId: string }> {
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) throw new Error('Nenhuma pousada ativa selecionada.')
  const role = await getActiveTenantRole()
  if (!role || !can(role, action)) throw new Error('Você não tem permissão para esta ação.')
  return { pousadaId }
}

export async function getLinkReport(input: ReportRangeInput): Promise<LinkReport> {
  const { pousadaId } = await requireCapability('link:report:view')
  return getLinkReportRpc(pousadaId, input.days)
}

export async function listQuoteRequests(): Promise<QuoteRequest[]> {
  const { pousadaId } = await requireCapability('quote:manage')
  return listQuoteRequestsByPousada(pousadaId)
}

export async function updateQuoteStatus(input: QuoteStatusInput): Promise<{ ok: true }> {
  await requireCapability('quote:manage')
  await setQuoteRequestStatusRpc({
    requestId: input.requestId,
    status: input.status,
    notes: input.notes,
  })
  revalidatePath('/dashboard/link')
  return { ok: true }
}

/**
 * Envio público do formulário de orçamento.
 *
 * Sem `requireCapability`: quem envia é um visitante sem sessão. A defesa está
 * na RPC — valida pousada publicada, telefone, datas, e limita a 3 pedidos por
 * telefone por hora — e agora também no Turnstile abaixo, que barra antes de
 * sequer chamar a RPC (`create_quote_request` só tinha o rate limit por
 * telefone; um robô trocando de número a cada envio passava direto).
 */
export async function submitQuoteRequest(input: QuoteRequestInput): Promise<{ id: string }> {
  const h = await headers()
  const remoteIp = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
  const humanVerified = await verifyTurnstileToken(input.turnstileToken, remoteIp)
  if (!humanVerified) {
    throw new Error(
      'Não foi possível confirmar que você não é um robô. Atualize a página e tente de novo.',
    )
  }

  const result = await createQuoteRequestRpc({
    pousadaId: input.pousadaId,
    name: input.name,
    phone: input.phone,
    email: input.email === '' ? null : input.email,
    checkin: input.checkin === '' ? null : input.checkin,
    checkout: input.checkout === '' ? null : input.checkout,
    adults: input.adults,
    children: input.children,
    pets: input.pets,
    occasion: input.occasion,
    message: input.message,
  })
  return { id: result.id }
}
