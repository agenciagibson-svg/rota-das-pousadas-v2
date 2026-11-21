import 'server-only'
import { revalidatePath } from 'next/cache'
import {
  listHiddenPostsAdmin,
  listHiddenPostSlugs,
  setPostHidden,
} from '@/repositories/blog-hidden-posts.repository'
import { ALL_POSTS } from '../posts'
import { canModerateTips, listTipsAdmin } from './tips.service'

/** Guias tirados do ar pelo painel (0113). Lido em toda página do blog. */
export function hiddenPostSlugs(): Promise<Set<string>> {
  return listHiddenPostSlugs()
}

export type GuideRow = {
  slug: string
  title: string
  place: string
  publishedAt: string
  /** publicado | rascunho (só na versão de teste) | fora_do_ar (tirado pelo painel). */
  state: 'publicado' | 'rascunho' | 'fora_do_ar'
  hiddenReason: string
  tips: { pending: number; approved: number }
}

/** Painel → Blog → Guias: todos os guias, com situação e dicas. */
export async function listGuidesAdmin(): Promise<GuideRow[]> {
  if (!(await canModerateTips())) throw new Error('Sem permissão.')
  const [hidden, tips] = await Promise.all([
    listHiddenPostsAdmin().catch(() => []),
    listTipsAdmin().catch(() => []),
  ])
  const hiddenBySlug = new Map(hidden.map((h) => [h.slug, h]))
  return [...ALL_POSTS]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((p) => {
      const h = hiddenBySlug.get(p.slug)
      return {
        slug: p.slug,
        title: p.title,
        place: p.place,
        publishedAt: p.publishedAt,
        state: h ? 'fora_do_ar' : p.status,
        hiddenReason: h?.reason ?? '',
        tips: {
          pending: tips.filter((t) => t.postSlug === p.slug && t.status === 'pendente').length,
          approved: tips.filter((t) => t.postSlug === p.slug && t.status === 'aprovada').length,
        },
      }
    })
}

/** Tirar do ar / voltar ao ar. A auditoria fica na RPC. */
export async function setGuideHidden(slug: string, hidden: boolean, reason: string): Promise<void> {
  if (!(await canModerateTips())) throw new Error('Sem permissão.')
  if (!ALL_POSTS.some((p) => p.slug === slug)) throw new Error('Guia não encontrado.')
  await setPostHidden(slug, hidden, reason)
  revalidatePath('/blog')
  revalidatePath(`/blog/${slug}`)
  revalidatePath('/sitemap.xml')
  revalidatePath('/admin/blog')
}
