/**
 * Acesso centralizado e tipado às variáveis de ambiente.
 * Segredos (service role) só são lidos em código server-only.
 */

function cleanEnv(value: string): string {
  return value.replace(/^\uFEFF/, '').trim()
}

export const publicEnv = {
  siteUrl: cleanEnv(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  supabaseUrl: cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''),
  supabaseAnonKey: cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''),
  /** Vazio até Gibson criar o site no Cloudflare Turnstile — nesse caso o widget não renderiza. */
  turnstileSiteKey: cleanEnv(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''),
} as const

/** True quando as credenciais públicas do Supabase estão presentes. */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey)
}

/**
 * "Continuar com Google" (login e cadastro). Só aparece com
 * `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`, depois de o provedor Google estar
 * ligado no Supabase (docs/configuracao/login-google-e-codigo.md) — sem isso o
 * botão levaria a uma tela de erro do Supabase.
 */
export function isGoogleAuthEnabled(): boolean {
  return cleanEnv(process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED ?? '') === 'true'
}

/**
 * Sem as credenciais do Supabase os repositórios caem nos dados de exemplo de
 * `lib/data.ts` — útil em desenvolvimento e nos testes. Em produção isso seria
 * uma vitrine de pousadas FICTÍCIAS no ar por causa de uma variável faltando;
 * melhor a página quebrar e o erro aparecer no deploy.
 */
export function assertNotMockInProduction(): void {
  if (process.env.VERCEL_ENV === 'production' && !isSupabaseConfigured()) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes em produção — o site não exibe dados de exemplo.',
    )
  }
}
