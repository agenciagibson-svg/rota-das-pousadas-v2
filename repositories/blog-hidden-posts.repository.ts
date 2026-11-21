import 'server-only'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseStaticClient } from '@/lib/supabase/static'

/** Guias tirados do ar pelo painel (0113). */

/**
 * Slugs fora do ar (leitura pública, sem sessão). Sem Supabase ou com erro,
 * nada fica escondido: o blog não pode cair por causa desta lista.
 */
export async function listHiddenPostSlugs(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set()
  try {
    const { data, error } = await createSupabaseStaticClient()
      .from('blog_hidden_posts')
      .select('slug')
    if (error) return new Set()
    return new Set((data ?? []).map((r) => r.slug))
  } catch {
    return new Set()
  }
}

export type HiddenPost = { slug: string; reason: string; hiddenAt: string }

export async function listHiddenPostsAdmin(): Promise<HiddenPost[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_blog_hidden_posts')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ slug: r.slug, reason: r.reason, hiddenAt: r.hidden_at }))
}

export async function setPostHidden(slug: string, hidden: boolean, reason: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('set_blog_post_hidden', {
    p_slug: slug,
    p_hidden: hidden,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
}
