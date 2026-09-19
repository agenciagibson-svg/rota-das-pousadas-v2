import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import { encryptToken } from '@/lib/crypto/token-cipher'
import { publicEnv } from '@/lib/env'
import {
  consumeOauthStateNonce,
  getPaymentAccountStatusByPousada,
  savePaymentAccountRpc,
} from '@/repositories/payment-accounts.repository'
import { requireCapability } from './access'
import { signState, verifyState } from './oauth-state'
import { buildAuthorizationUrl, exchangeCodeForToken } from './mp-client'

function callbackUrl(): string {
  return `${publicEnv.siteUrl}/api/pagamentos/mercadopago/callback`
}

/** Chamada pela server action de "Conectar Mercado Pago" — exige `payment:connect_account`. */
export async function getConnectAuthorizationUrl(): Promise<string> {
  const { pousadaId } = await requireCapability('payment:connect_account')
  const state = signState(pousadaId)
  return buildAuthorizationUrl({ redirectUri: callbackUrl(), state })
}

/**
 * Chamada pelo route handler de callback, depois que o `state` já foi
 * verificado (assinatura + validade). Aqui a checagem de permissão é feita
 * a partir dos memberships REAIS do usuário logado para a pousada do
 * `state` — não a pousada "ativa" da sessão (podem ser diferentes se o
 * usuário trocou de aba/pousada no meio do fluxo OAuth), como decidido no
 * plano desta feature.
 */
export async function completeConnection(input: { code: string; state: string }): Promise<void> {
  const decoded = verifyState(input.state)
  if (!decoded) throw new Error('Link de conexão inválido ou expirado. Tente novamente.')

  // Uso único: um `state` válido (assinatura + prazo) só completa a conexão
  // uma vez. Sem isso, um `state` capturado (log de proxy, histórico do
  // navegador) continuaria utilizável por até 10 minutos.
  const isFreshNonce = await consumeOauthStateNonce(decoded.nonce)
  if (!isFreshNonce)
    throw new Error('Este link de conexão já foi usado. Inicie a conexão novamente.')

  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para concluir a conexão.')

  const isPlatformMaster = user.platformRole === 'master'
  const membership = user.memberships.find(
    (m) => m.pousadaId === decoded.pousadaId && m.status === 'active',
  )
  const authorized =
    isPlatformMaster || (membership && can(membership.role, 'payment:connect_account'))
  if (!authorized) {
    throw new Error('Você não tem permissão para conectar a conta de pagamento desta pousada.')
  }

  const token = await exchangeCodeForToken({ code: input.code, redirectUri: callbackUrl() })

  await savePaymentAccountRpc({
    pousadaId: decoded.pousadaId,
    mpUserId: String(token.user_id),
    accessTokenEncrypted: encryptToken(token.access_token),
    refreshTokenEncrypted: encryptToken(token.refresh_token),
    publicKey: token.public_key ?? null,
    liveMode: token.live_mode ?? false,
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  })
}

/**
 * Status para a tela de Configurações. Nunca lança — mesma resiliência de
 * `getOwnerSettings` (retorna null se não houver pousada ativa), porque é
 * usada dentro de um `Promise.all` de leitura de página. Ver é mais
 * permissivo que conectar: proprietario/admin_pousada podem ver (mesmo
 * escopo da RLS de leitura em `pousada_payment_accounts`), mas só quem tem
 * `payment:connect_account` (proprietario/master) vê o botão habilitado —
 * daí o `canConnect` calculado aqui em vez de bloquear a leitura toda.
 */
export async function getOwnerPaymentAccountStatus(): Promise<{
  connected: boolean
  liveMode: boolean
  canConnect: boolean
} | null> {
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) return null
  const role = await getActiveTenantRole()
  if (!role || !can(role, 'pousada:edit')) return null

  const status = await getPaymentAccountStatusByPousada(pousadaId)
  if (!status) return null
  return { ...status, canConnect: can(role, 'payment:connect_account') }
}
