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
} as const

/** True quando as credenciais públicas do Supabase estão presentes. */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey)
}
