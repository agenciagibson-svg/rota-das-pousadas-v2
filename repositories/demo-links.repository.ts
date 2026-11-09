import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { DemoLinkInfo } from '@/features/demonstracao/demo'

/**
 * Link de demonstração (0101). A tabela é fechada: tudo passa pelas RPCs, que
 * conferem permissão (gerar/listar/desativar: comercial e master) e cortam o
 * que a página pública pode ver (`get_demo_pousada`).
 */

/** Página pública: pousada + acomodações, ou só o endereço se já foi publicada. Conta a abertura. */
export async function getDemoPousadaRpc(token: string): Promise<unknown> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_demo_pousada', { p_token: token })
  if (error) throw new Error(error.message)
  return data
}

export async function createDemoLinkRpc(pousadaId: string, renew: boolean): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_pousada_demo_link', {
    p_pousada_id: pousadaId,
    p_renew: renew,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function revokeDemoLinkRpc(pousadaId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('revoke_pousada_demo_link', { p_pousada_id: pousadaId })
  if (error) throw new Error(error.message)
}

export type DemoLinkRow = DemoLinkInfo

export async function listDemoLinksRpc(): Promise<DemoLinkRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_pousada_demo_links')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    pousadaId: r.pousada_id,
    token: r.token,
    active: r.active,
    createdAt: r.created_at,
    views: r.views,
    firstViewedAt: r.first_viewed_at,
    lastViewedAt: r.last_viewed_at,
  }))
}
