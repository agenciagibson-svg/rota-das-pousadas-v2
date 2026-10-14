import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { orNull } from '@/lib/supabase/rpc-args'

export type PaymentAccountRow = {
  pousadaId: string
  mpUserId: string | null
  /** Cifrado — decifrar só em `features/pagamentos/services` via `lib/crypto/token-cipher`. */
  accessToken: string | null
  /** Cifrado — decifrar só em `features/pagamentos/services` via `lib/crypto/token-cipher`. */
  refreshToken: string | null
  publicKey: string | null
  liveMode: boolean
  connectedAt: string | null
}

export type SavePaymentAccountParams = {
  pousadaId: string
  mpUserId: string
  /** Já cifrado pelo chamador — esta função nunca cifra nem decifra. */
  accessTokenEncrypted: string
  /** Já cifrado pelo chamador — esta função nunca cifra nem decifra. */
  refreshTokenEncrypted: string
  publicKey: string | null
  liveMode: boolean
  expiresAt: string | null
}

/** Só para a tela de Configurações — não traz tokens, apenas se há conexão. */
export async function getPaymentAccountStatusByPousada(
  pousadaId: string,
): Promise<{ connected: boolean; liveMode: boolean } | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousada_payment_accounts')
    .select('live_mode')
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (error) throw error
  if (!data) return { connected: false, liveMode: false }
  return { connected: true, liveMode: data.live_mode }
}

/** Para o checkout — traz os tokens cifrados da pousada que vai receber o pagamento. */
export async function getPaymentAccountByPousada(
  pousadaId: string,
): Promise<PaymentAccountRow | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousada_payment_accounts')
    .select(
      'pousada_id, mp_user_id, access_token, refresh_token, public_key, live_mode, connected_at',
    )
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    pousadaId: data.pousada_id,
    mpUserId: data.mp_user_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    publicKey: data.public_key,
    liveMode: data.live_mode,
    connectedAt: data.connected_at,
  }
}

/** Grava a conexão via RPC `save_payment_account` (0039) — nunca insert/update direto na tabela. */
export async function savePaymentAccountRpc(p: SavePaymentAccountParams): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('save_payment_account', {
    p_pousada_id: p.pousadaId,
    p_mp_user_id: p.mpUserId,
    p_access_token: p.accessTokenEncrypted,
    p_refresh_token: p.refreshTokenEncrypted,
    p_public_key: orNull(p.publicKey),
    p_live_mode: p.liveMode,
    p_expires_at: orNull(p.expiresAt),
  })
  if (error) throw new Error(error.message)
}

/**
 * Consome (marca como usado) o nonce de um `state` OAuth já validado
 * (assinatura + validade) — RPC `consume_oauth_state_nonce` (migration 0053).
 * `true` na primeira vez; `false` se este nonce já foi consumido antes
 * (replay do mesmo `state` dentro da janela de 10 minutos).
 */
export async function consumeOauthStateNonce(nonce: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('consume_oauth_state_nonce', { p_nonce: nonce })
  if (error) throw new Error(error.message)
  return Boolean(data)
}
