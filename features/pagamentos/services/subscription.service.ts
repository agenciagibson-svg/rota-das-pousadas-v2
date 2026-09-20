import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import { publicEnv } from '@/lib/env'
import {
  getActivePlan,
  getSubscriptionByPousada,
  createPendingSubscriptionRpc,
  syncSubscriptionStatusRpc,
  recordSubscriptionInvoiceRpc,
  setPlanPreapprovalId,
  type SubscriptionStatus,
} from '@/repositories/subscriptions.repository'
import {
  createPreapprovalPlan,
  createPreapproval,
  getPreapprovalById,
  getAuthorizedPaymentById,
  mapAuthorizedPaymentStatus,
} from './mp-client'

function assinaturaBackUrl(): string {
  return `${publicEnv.siteUrl}/dashboard/configuracoes`
}

/**
 * Cria o "molde" do plano na API do Mercado Pago (uma vez só, com a conta de
 * verdade da Rota) e salva o `mp_preapproval_plan_id` em `plans`. Chamada
 * manualmente pelo master quando `MERCADO_PAGO_PLATFORM_ACCESS_TOKEN`
 * estiver configurada — nunca durante a migration (sem rede/segredos ali).
 * Reexecutar é seguro (idempotente na prática): se o plano já tem
 * `mpPreapprovalPlanId`, não cria outro.
 */
export async function bootstrapPlatformPlan(): Promise<{ mpPreapprovalPlanId: string }> {
  const user = await getCurrentUser()
  if (!user?.platformRole || user.platformRole !== 'master') {
    throw new Error('Somente master pode configurar o plano de assinatura da plataforma.')
  }
  const plan = await getActivePlan()
  if (!plan) throw new Error('Nenhum plano ativo encontrado.')
  if (plan.mpPreapprovalPlanId) return { mpPreapprovalPlanId: plan.mpPreapprovalPlanId }

  const created = await createPreapprovalPlan({
    reason: `Assinatura Rota das Pousadas — ${plan.name}`,
    price: plan.price,
    backUrl: assinaturaBackUrl(),
  })
  await setPlanPreapprovalId(plan.id, created.id)
  return { mpPreapprovalPlanId: created.id }
}

export type OwnerSubscriptionStatus = {
  planName: string
  planPrice: number
  status: SubscriptionStatus | 'none'
  nextBillingDate: string | null
  canManage: boolean
}

/** Status pra tela de Configurações — nunca lança (mesma resiliência de `getOwnerPaymentAccountStatus`). */
export async function getOwnerSubscriptionStatus(): Promise<OwnerSubscriptionStatus | null> {
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) return null
  const role = await getActiveTenantRole()
  if (!role) return null

  const plan = await getActivePlan()
  if (!plan) return null
  const subscription = await getSubscriptionByPousada(pousadaId)

  return {
    planName: plan.name,
    planPrice: plan.price,
    status: subscription?.status ?? 'none',
    nextBillingDate: subscription?.nextBillingDate ?? null,
    canManage: can(role, 'subscription:manage'),
  }
}

/**
 * Gera o link de autorização no Mercado Pago pra pousada assinar (ou
 * reassinar, depois de um cancelamento) o plano. Só `subscription:manage`
 * (proprietario/master — ver rbac.ts) e só se o plano já tem
 * `mpPreapprovalPlanId` (ver `bootstrapPlatformPlan`). Não coleta cartão
 * aqui: quem coleta é o checkout do próprio Mercado Pago no `init_point`.
 */
export async function startSubscriptionAuthorization(): Promise<{ initPoint: string }> {
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) throw new Error('Nenhuma pousada ativa selecionada.')
  const role = await getActiveTenantRole()
  if (!role || !can(role, 'subscription:manage')) {
    throw new Error('Você não tem permissão para assinar o plano desta pousada.')
  }
  const user = await getCurrentUser()
  if (!user?.email) throw new Error('Faça login para continuar.')

  const plan = await getActivePlan()
  if (!plan?.mpPreapprovalPlanId) {
    throw new Error('O plano de assinatura ainda não foi configurado pela plataforma.')
  }

  const preapproval = await createPreapproval({
    preapprovalPlanId: plan.mpPreapprovalPlanId,
    payerEmail: user.email,
    externalReference: pousadaId,
    backUrl: assinaturaBackUrl(),
  })
  if (!preapproval.init_point) {
    throw new Error('O Mercado Pago não retornou o link de autorização da assinatura.')
  }

  await createPendingSubscriptionRpc({
    pousadaId,
    planId: plan.id,
    mpPreapprovalId: preapproval.id,
  })

  return { initPoint: preapproval.init_point }
}

/**
 * Processa o webhook `subscription_preapproval` já com assinatura
 * verificada (`verifyWebhookSignature`, reaproveitado de webhook.service.ts
 * — mesmo segredo/esquema HMAC, a conta que recebe é a mesma). Sempre
 * re-busca o preapproval pela API antes de gravar — nunca confia no corpo
 * do webhook (mesma regra de `processPaymentNotification`).
 */
export async function processSubscriptionPreapprovalNotification(
  mpPreapprovalId: string,
): Promise<void> {
  const detail = await getPreapprovalById(mpPreapprovalId)
  if (String(detail.id) !== mpPreapprovalId) throw new Error('ID de assinatura divergente.')

  await syncSubscriptionStatusRpc({
    mpPreapprovalId: detail.id,
    status: detail.status,
    nextBillingDate: detail.next_payment_date ?? null,
  })
}

/**
 * Processa o webhook `subscription_authorized_payment` (cada cobrança
 * recorrente de verdade) — mesma regra de nunca confiar no corpo do
 * webhook, sempre re-busca pela API.
 */
export async function processSubscriptionAuthorizedPaymentNotification(
  authorizedPaymentId: string,
): Promise<void> {
  const payment = await getAuthorizedPaymentById(authorizedPaymentId)
  if (String(payment.id) !== authorizedPaymentId) throw new Error('ID de cobrança divergente.')

  await recordSubscriptionInvoiceRpc({
    mpPreapprovalId: payment.preapproval_id,
    mpPaymentId: payment.id,
    amount: payment.transaction_amount,
    status: mapAuthorizedPaymentStatus(payment.status),
    periodStart: null,
    periodEnd: null,
    paidAt: payment.date_created ?? null,
  })
}
