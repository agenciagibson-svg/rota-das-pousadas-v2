import { NextResponse, type NextRequest } from 'next/server'
import {
  exchangeAuthCode,
  redirectAfterSignIn,
} from '@/features/auth/services/passwordless.service'
import { guestLoginPath } from '@/features/auth/passwordless'
import { safeNextPath } from '@/features/auth/profile'

/**
 * Retorno do "Continuar com Google" e do link padrão do e-mail (fluxo PKCE do
 * `@supabase/ssr`): troca o `code` pela sessão e volta para o `next`
 * validado — só caminho interno, nunca `//host` nem URL externa.
 *
 * Os cookies da sessão gravados por `exchangeCodeForSession` (via `cookies()`)
 * seguem junto com o redirecionamento. Sem `code` (Google cancelado, link
 * aberto em outro navegador, `?error=` do Supabase) volta para o login com
 * um aviso e o mesmo destino, para a pessoa tentar pelo código.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const next = safeNextPath(params.get('next'))
  const code = params.get('code')

  if (code && code.length <= 512 && (await exchangeAuthCode(code))) {
    return NextResponse.redirect(new URL(redirectAfterSignIn(next), request.nextUrl.origin))
  }

  return NextResponse.redirect(new URL(guestLoginPath(next, 'retorno'), request.nextUrl.origin))
}
