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
export async function exchangeCodeForToken(params: { code: string; redirectUri: string }): Promise<MpTokenResponse> {
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
}

/**
 * ⚠️ `marketplace_fee` foi removido de propósito (13/09/2026). A Rota é SaaS por
 * assinatura: não cobra comissão sobre reserva, não faz split e não custodia
 * fundos — o pagamento vai integralmente para a conta da pousada. Reintroduzir
 * esse campo muda o modelo de negócio e a exposição regulatória (KYC de
 * marketplace, chargeback); exige revisar `docs/04_BUSINESS_ARCHITECTURE.md §9`
 * antes, não apenas alterar este arquivo.
 */
export async function createCheckoutPreference(params: CreatePreferenceParams): Promise<MpPreference> {
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
      notification_url: params.notificationUrl,
      back_urls: params.backUrls,
      auto_return: 'approved',
    }),
  })
  if (!response.ok) {
    throw new Error(`Falha ao criar preferência de pagamento no Mercado Pago (${response.status}).`)
  }
  return response.json()
}

export const mpPaymentSchema = z.object({
  id: z.number().int().positive().safe(),
  status: z.enum(['approved', 'pending', 'rejected', 'refunded', 'cancelled', 'in_process', 'charged_back', 'authorized', 'in_mediation']),
  transaction_amount: z.number().positive().finite(),
  transaction_amount_refunded: z.number().nonnegative().finite(),
  currency_id: z.literal('BRL'),
  date_last_updated: z.string().datetime({ offset: true }),
  payment_method_id: z.string().min(1),
  external_reference: z.string().uuid(),
})
export type MpPayment = z.infer<typeof mpPaymentSchema>

/** Sempre re-busca o pagamento pelo ID — nunca confiar no corpo do webhook. */
export async function getPaymentById(paymentId: string, sellerAccessToken: string): Promise<MpPayment> {
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
