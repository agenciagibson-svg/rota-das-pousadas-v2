/** Público do fluxo de nova senha — decide para onde a pessoa vai depois. */
export type ResetAudience = 'hospede' | 'parceiro' | 'admin'

export const RESET_REDIRECT: Record<ResetAudience, string> = {
  hospede: '/minhas-reservas',
  parceiro: '/dashboard',
  admin: '/admin',
}

export function parseResetAudience(value: string | null | undefined): ResetAudience {
  return value === 'parceiro' || value === 'admin' ? value : 'hospede'
}

/** Página de login de cada público (link "Voltar para o login"). */
export const LOGIN_PATH: Record<ResetAudience, string> = {
  hospede: '/login',
  parceiro: '/parceiros/login',
  admin: '/admin/login',
}
