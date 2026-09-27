import 'server-only'
import { z } from 'zod'

/**
 * Cliente HTTP fino para a API do Mercado Pago. Segredos da PLATAFORMA (app
 * OAuth registrado uma vez, usado para conectar cada pousada) — nunca o
 * token de uma pousada, que é dado por tenant vindo do banco (cifrado),
 * nunca de env var. Ver `.env.example`.
 *
 * ⚠️ Nomes de endpoint/campos conferidos na documentação oficial em
 * 2026-09 (docs.mercadopago.com); revalidar se o Mercado Pago anunciar
 * mudança de versão da API antes de operar em produção.
 */

const MP_API_BASE = 'https://api.mercadopago.com'
const MP_AUTH_BASE = 'https://auth.mercadopago.com'

function getAppCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.MERCADO_PAGO_APP_ID
  const clientSecret = process.env.MERCADO_PAGO_APP_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('MERCADO_PAGO_APP_ID/MERCADO_PAGO_APP_SECRET não configurados.')
  }
  return { clientId, clientSecret }
}

export function buildAuthorizationUrl(params: { redirectUri: string; state: string }): string {
  const { clientId } = getAppCredentials()
  const url = new URL('/authorization', MP_AUTH_BASE)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('platform_id', 'mp')
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  return url.toString()
}

export type MpTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  user_id: number
  refresh_token: string
  public_key: string
  live_mode: boolean
}

/**
 * O Mercado Pago não tem credencial OAuth separada pra teste — o token
 * gerado é sempre de produção (`APP_USR-...`), mesmo quando quem autoriza é
 * uma conta real. Pra testar sem mexer com dinheiro de verdade (inclusive
 * com uma conta pessoa física real, como a usada no ambiente de testes desta
 * pousada), envia-se `test_token: true` na troca do código — isso devolve um
 * token que só funciona com cartões de teste do Mercado Pago. Controlado por
 * `MERCADO_PAGO_TEST_MODE=true` no `.env.local`; remover essa variável (ou
 * deixar `false`) quando for para produção de verdade.
 */
export async function exchangeCodeForToken(params: {
  code: string
  redirectUri: string
}): Promise<MpTokenResponse> {
  const { clientId, clientSecret } = getAppCredentials()
  const testMode = process.env.MERCADO_PAGO_TEST_MODE === 'true'
  const response = await fetch(`${MP_API_BASE}/oauth/token`, {
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      ...(testMode ? { test_token: true } : {}),
    }),
  })
  if (!response.ok) {
    throw new Error(`Falha ao trocar código OAuth do Mercado Pago (${response.status}).`)
  }
  return response.json()
}

export type MpPreference = {
  id: string
  init_point: string
  sandbox_init_point: string
}

export type CreatePreferenceParams = {
  /** Token da PRÓPRIA pousada — o pagamento é criado em nome dela, não da plataforma. */
  sellerAccessToken: string
  title: string
  quantity: number
  unitPrice: number
  externalReference: string
  notificationUrl: string
  backUrls: { success: string; pending: string; failure: string }
  /**
   * Fim do prazo de pagamento da reserva (ISO). O link do Checkout Pro expira
   * junto, para o hóspede não pagar uma reserva já cancelada por prazo (0070).
   */
  expiresAt?: string | null
  /**
   * Dados do hóspede já logado. Vão em `payer` para o Checkout Pro já abrir
   * com o e-mail preenchido — o hóspede não precisa digitar de novo.
   */
  payer?: { email?: string | null; name?: string | null }
}

/** Monta o `payer` só com campos válidos (e-mail inválido é omitido, nunca quebra o checkout). */
export function buildPayer(payer: CreatePreferenceParams['payer']) {
  const email = payer?.email?.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined
  const [first, ...rest] = (payer?.name ?? '').trim().split(/\s+/).filter(Boolean)
  return {
    email,
    ...(first ? { name: first } : {}),
    ...(rest.length ? { surname: rest.join(' ') } : {}),
  }
}

/**
 * ⚠️ `marketplace_fee` foi removido de propósito (13/09/2026). A Rota é SaaS por
 * assinatura: não cobra comissão sobre reserva, não faz split e não custodia
 * fundos — o pagamento vai integralmente para a conta da pousada. Reintroduzir
 * esse campo muda o modelo de negócio e a exposição regulatória (KYC de
 * marketplace, chargeback); exige revisar `docs/04_BUSINESS_ARCHITECTURE.md §9`
 * antes, não apenas alterar este arquivo.
 */
export async function createCheckoutPreference(
  params: CreatePreferenceParams,
): Promise<MpPreference> {
  const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.sellerAccessToken}`,
    },
    body: JSON.stringify({
      items: [
        {
          title: params.title,
          quantity: params.quantity,
          unit_price: params.unitPrice,
          currency_id: 'BRL',
        },
      ],
      external_reference: params.externalReference,
      ...(buildPayer(params.payer) ? { payer: buildPayer(params.payer) } : {}),
      notification_url: params.notificationUrl,
      back_urls: params.backUrls,
      auto_return: 'approved',
      // Só Pix e cartão: boleto (`ticket`) e lotérica (`atm`) compensam em dias,
      // incompatível com o prazo de 2h da reserva on-line (0070).
      payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
      ...(params.expiresAt ? { expires: true, expiration_date_to: params.expiresAt } : {}),
    }),
  })
  if (!response.ok) {
    throw new Error(`Falha ao criar preferência de pagamento no Mercado Pago (${response.status}).`)
  }
  return response.json()
}

export const mpPaymentSchema = z.object({
  id: z.number().int().positive().safe(),
  status: z.enum([
    'approved',
    'pending',
    'rejected',
    'refunded',
    'cancelled',
    'in_process',
    'charged_back',
    'authorized',
    'in_mediation',
  ]),
  transaction_amount: z.number().positive().finite(),
  transaction_amount_refunded: z.number().nonnegative().finite(),
  currency_id: z.literal('BRL'),
  date_last_updated: z.string().datetime({ offset: true }),
  payment_method_id: z.string().min(1),
  external_reference: z.string().uuid(),
})
export type MpPayment = z.infer<typeof mpPaymentSchema>

/** Sempre re-busca o pagamento pelo ID — nunca confiar no corpo do webhook. */
export async function getPaymentById(
  paymentId: string,
  sellerAccessToken: string,
): Promise<MpPayment> {
  if (!/^\d{1,40}$/.test(paymentId)) throw new Error('ID de pagamento inválido.')
  const response = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${sellerAccessToken}` },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Falha ao buscar pagamento ${paymentId} no Mercado Pago (${response.status}).`)
  }
  return mpPaymentSchema.parse(await response.json())
}

/**
 * ⚠️ ASSINATURAS (preapproval) — API DIFERENTE do Checkout Pro acima. Aqui a
 * Rota é a própria cobradora: usa a conta MP DA PLATAFORMA (token de
 * `getPlatformAccessToken`, não o token cifrado de uma pousada) para cobrar
 * a pousada recorrentemente pela assinatura. Nomes de campo conferidos na
 * documentação oficial em 2026-09 (docs.mercadopago.com/developers/pt/docs/subscriptions);
 * como esta integração ainda não foi exercitada contra o ambiente de testes
 * do Mercado Pago, REVALIDAR o formato exato da resposta (em especial
 * `next_payment_date` do preapproval e o formato do authorized_payment)
 * antes de operar em produção.
 */
function getPlatformAccessToken(): string {
  const token = process.env.MERCADO_PAGO_PLATFORM_ACCESS_TOKEN
  if (!token) throw new Error('MERCADO_PAGO_PLATFORM_ACCESS_TOKEN não configurada.')
  return token
}

export type MpPreapprovalPlan = { id: string }

export type CreatePreapprovalPlanParams = {
  reason: string
  price: number
  backUrl: string
}

/** Cria o "molde" da assinatura (valor + periodicidade) uma única vez — o `id` fica salvo em `plans.mp_preapproval_plan_id`. */
export async function createPreapprovalPlan(
  params: CreatePreapprovalPlanParams,
): Promise<MpPreapprovalPlan> {
  const response = await fetch(`${MP_API_BASE}/preapproval_plan`, {
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getPlatformAccessToken()}`,
    },
    body: JSON.stringify({
      reason: params.reason,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: params.price,
        currency_id: 'BRL',
      },
      back_url: params.backUrl,
    }),
  })
  if (!response.ok) {
    throw new Error(`Falha ao criar o plano de assinatura no Mercado Pago (${response.status}).`)
  }
  const data = (await response.json()) as { id: string }
  return { id: data.id }
}

export type MpPreapproval = {
  id: string
  status: string
  /** Link de checkout pra pousada autorizar a cobrança com o próprio cartão — só vem na criação. */
  init_point?: string
}

export type CreatePreapprovalParams = {
  preapprovalPlanId: string
  /** E-mail do responsável pela pousada — MP usa pra identificar o pagador no checkout de autorização. */
  payerEmail: string
  /** `pousadaId` — permite ao webhook (que só recebe o `preapproval_id`) achar a assinatura mesmo antes do primeiro sync. */
  externalReference: string
  backUrl: string
}

/** Gera o link de autorização de uma pousada específica pro plano já criado. Nunca coleta cartão — quem coleta é o checkout do próprio Mercado Pago. */
export async function createPreapproval(params: CreatePreapprovalParams): Promise<MpPreapproval> {
  const response = await fetch(`${MP_API_BASE}/preapproval`, {
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getPlatformAccessToken()}`,
    },
    body: JSON.stringify({
      preapproval_plan_id: params.preapprovalPlanId,
      payer_email: params.payerEmail,
      external_reference: params.externalReference,
      back_url: params.backUrl,
      status: 'pending',
    }),
  })
  if (!response.ok) {
    throw new Error(`Falha ao criar a assinatura no Mercado Pago (${response.status}).`)
  }
  return response.json()
}

export const mpPreapprovalStatusSchema = z.enum(['pending', 'authorized', 'paused', 'cancelled'])

const mpPreapprovalDetailSchema = z.object({
  id: z.string().min(1),
  status: mpPreapprovalStatusSchema,
  external_reference: z.string().nullable().optional(),
  // ⚠️ Campo ainda não validado contra resposta real do Mercado Pago — ver
  // aviso no topo desta seção. Fica opcional/nulo de propósito: um nome de
  // campo errado aqui não pode derrubar a sincronização de status.
  next_payment_date: z.string().nullable().optional(),
})
export type MpPreapprovalDetail = z.infer<typeof mpPreapprovalDetailSchema>

/** Sempre re-busca o preapproval pelo ID — nunca confiar no corpo do webhook (mesma regra de `getPaymentById`). */
export async function getPreapprovalById(preapprovalId: string): Promise<MpPreapprovalDetail> {
  if (!/^[\w-]{1,60}$/.test(preapprovalId)) throw new Error('ID de assinatura inválido.')
  const response = await fetch(`${MP_API_BASE}/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${getPlatformAccessToken()}` },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(
      `Falha ao buscar assinatura ${preapprovalId} no Mercado Pago (${response.status}).`,
    )
  }
  return mpPreapprovalDetailSchema.parse(await response.json())
}

const mpAuthorizedPaymentSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  preapproval_id: z.string().min(1),
  status: z.string().min(1),
  transaction_amount: z.number().nonnegative().finite(),
  date_created: z.string().nullable().optional(),
})
export type MpAuthorizedPayment = z.infer<typeof mpAuthorizedPaymentSchema>

/** Cada cobrança recorrente de verdade da assinatura — evento `subscription_authorized_payment`. */
export async function getAuthorizedPaymentById(
  authorizedPaymentId: string,
): Promise<MpAuthorizedPayment> {
  if (!/^[\w-]{1,60}$/.test(authorizedPaymentId))
    throw new Error('ID de cobrança de assinatura inválido.')
  const response = await fetch(`${MP_API_BASE}/authorized_payments/${authorizedPaymentId}`, {
    headers: { Authorization: `Bearer ${getPlatformAccessToken()}` },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(
      `Falha ao buscar cobrança de assinatura ${authorizedPaymentId} no Mercado Pago (${response.status}).`,
    )
  }
  return mpAuthorizedPaymentSchema.parse(await response.json())
}

/** Mapeia o status de authorized_payment do Mercado Pago pro enum de `invoices.status`. */
export function mapAuthorizedPaymentStatus(
  status: string,
): 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled' {
  switch (status) {
    case 'processed':
      return 'approved'
    case 'rejected':
      return 'rejected'
    case 'cancelled':
      return 'cancelled'
    case 'refunded':
      return 'refunded'
    default:
      return 'pending'
  }
}

const mpPaymentSearchSchema = z.object({ results: z.array(z.unknown()).default([]) })

/**
 * Busca os pagamentos de uma reserva pelo `external_reference` (= bookingId).
 * Rede de segurança do webhook: se o aviso do Mercado Pago não chegar ou for
 * recusado, a reserva ainda é confirmada quando o hóspede volta ao site.
 * Resultados fora do formato esperado são ignorados, nunca derrubam a busca.
 */
export async function searchPaymentsByExternalReference(
  externalReference: string,
  sellerAccessToken: string,
): Promise<MpPayment[]> {
  if (!/^[0-9a-f-]{36}$/i.test(externalReference)) throw new Error('Referência inválida.')
  const url = new URL(`${MP_API_BASE}/v1/payments/search`)
  url.searchParams.set('external_reference', externalReference)
  url.searchParams.set('sort', 'date_created')
  url.searchParams.set('criteria', 'desc')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${sellerAccessToken}` },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Falha ao buscar pagamentos no Mercado Pago (${response.status}).`)
  }
  const { results } = mpPaymentSearchSchema.parse(await response.json())
  return results.flatMap((item) => {
    const parsed = mpPaymentSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}
