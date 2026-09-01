import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type FavoriteAlertState = {
  slug: string
  active: boolean
}

async function getPublishedPousadaIdBySlug(slug: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousadas')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'publicada')
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function listFavoriteAlertStates(userId: string): Promise<FavoriteAlertState[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('favorite_alerts')
    .select('pousadas!inner(slug), status')
    .eq('user_id', userId)
  if (error) throw error

  return (data ?? [])
    .map((alert) => {
      const pousada = Array.isArray(alert.pousadas) ? alert.pousadas[0] : alert.pousadas
      return pousada?.slug ? { slug: pousada.slug, active: alert.status === 'ativo' } : null
    })
    .filter((alert): alert is FavoriteAlertState => Boolean(alert))
}

export async function toggleFavoriteAlert(
  userId: string,
  slug: string,
): Promise<{ active: boolean }> {
  const pousadaId = await getPublishedPousadaIdBySlug(slug)
  if (!pousadaId) throw new Error('Pousada nao encontrada.')

  const supabase = await createSupabaseServerClient()
  const { data: existing, error: existingError } = await supabase
    .from('favorite_alerts')
    .select('status')
    .eq('user_id', userId)
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (existingError) throw existingError

  if (existing?.status === 'ativo') {
    const { error } = await supabase
      .from('favorite_alerts')
      .update({ status: 'pausado', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('pousada_id', pousadaId)
    if (error) throw error
    return { active: false }
  }

  const { error } = await supabase.from('favorite_alerts').upsert({
    user_id: userId,
    pousada_id: pousadaId,
    status: 'ativo',
    alert_kind: 'ofertas',
    channels: ['email'],
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
  return { active: true }
}
