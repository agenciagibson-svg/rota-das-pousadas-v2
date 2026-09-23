import 'server-only'
import { cache } from 'react'
import { connection } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env'
import { getProfileWithRoles, updateProfileName } from '@/repositories/profiles.repository'
import type { SessionUser } from '@/features/auth/types'

/**
 * Resolve o usuário autenticado atual: sessão (Supabase Auth) + profile + papéis.
 * Retorna null se não houver sessão ou se o Supabase não estiver configurado.
 * Regra de aplicação do domínio de auth vive aqui.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) {
    // Sem Supabase não há cookie para ler, mas a resposta continua sendo por
    // requisição: `connection()` mantém a rota dinâmica, como o `cookies()`
    // faz em produção (ver CSP em `proxy.ts`). Sem isso o build tenta
    // pré-renderizar páginas logadas (/dashboard, /admin) e quebra.
    await connection()
    return null
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const profile = await getProfileWithRoles(user.id)
  const metadataName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''

  return {
    id: user.id,
    email: user.email ?? '',
    name: profile?.fullName || metadataName,
    platformRole: profile?.platformRole ?? null,
    memberships: profile?.memberships ?? [],
  }
})

/**
 * Completa/corrige o nome do usuário autenticado. Hoje só a reserva pública
 * (`bookings.service.ts`) exige nome válido para seguir — isso existe para
 * dar uma saída a quem chega lá sem nome, em vez de travar sem nenhuma tela
 * de cadastro para editar.
 */
export async function updateMyName(name: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Faça login para continuar.')
  await updateProfileName(user.id, name.trim())
}
