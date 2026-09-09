import { NextResponse, type NextRequest } from 'next/server'
import { completeConnection } from '@/features/pagamentos/services/oauth.service'
import { publicEnv } from '@/lib/env'

/**
 * Callback do OAuth do Mercado Pago — o proprietário volta pra cá depois de
 * autorizar a conexão no site do Mercado Pago. `state` é verificado dentro
 * de `completeConnection` (assinatura + validade + permissão real do
 * usuário logado para a pousada codificada nele).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const settingsUrl = new URL('/dashboard/configuracoes', publicEnv.siteUrl)

  if (!code || !state) {
    settingsUrl.searchParams.set('mp', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    await completeConnection({ code, state })
    settingsUrl.searchParams.set('mp', 'connected')
  } catch (error) {
    console.error('[mercadopago:callback]', error)
    settingsUrl.searchParams.set('mp', 'error')
  }

  return NextResponse.redirect(settingsUrl)
}
