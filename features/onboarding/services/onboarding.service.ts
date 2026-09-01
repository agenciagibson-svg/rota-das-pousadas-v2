import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { uniqueSlug } from '@/lib/slug'
import type { CreatePousadaInput } from '../schemas'

/**
 * Cria a pousada do proprietário via RPC atômica (pousada em_analise +
 * acomodação + membership). Exige autenticação. A pousada só fica pública após
 * aprovação do admin (RB-01).
 */
export async function createPousada(input: CreatePousadaInput): Promise<{ slug: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para cadastrar sua pousada.')

  const supabase = await createSupabaseServerClient()
  const slug = uniqueSlug(input.name)

  const { data, error } = await supabase.rpc('create_pousada', {
    p_name: input.name,
    p_city: input.city,
    p_state: input.state,
    p_description: input.description,
    p_price: input.pricePerNight,
    p_slug: slug,
  })
  if (error) throw new Error(error.message)

  return { slug: data ?? slug }
}
