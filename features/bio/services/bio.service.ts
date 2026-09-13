import 'server-only'
import { revalidatePath } from 'next/cache'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can, type Action } from '@/lib/auth/rbac'
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
 * telefone por hora.
 */
export async function submitQuoteRequest(input: QuoteRequestInput): Promise<{ id: string }> {
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
