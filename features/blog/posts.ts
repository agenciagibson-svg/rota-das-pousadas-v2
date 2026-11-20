import type { BlogBlock, BlogPost } from './types'
import { serraDaCanastraSaoRoque } from './posts/serra-da-canastra-sao-roque-de-minas'
import { delfinopolisCachoeiras } from './posts/delfinopolis-cachoeiras'

/**
 * Textos do blog. Cada texto é um arquivo em `posts/`. Novo texto entra como
 * `rascunho`: aparece só na versão de teste da Vercel, para aprovação; depois
 * de aprovado vira `publicado` e vai para o site, o sitemap e o Google.
 */
export const ALL_POSTS: BlogPost[] = [serraDaCanastraSaoRoque, delfinopolisCachoeiras]

/** Versão de teste da Vercel (ou local): mostra os rascunhos. */
export function showDrafts(env = process.env.VERCEL_ENV): boolean {
  return env !== 'production'
}

export function visiblePosts(includeDrafts = showDrafts()): BlogPost[] {
  return ALL_POSTS.filter((p) => includeDrafts || p.status === 'publicado').sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  )
}

export function findPost(slug: string, includeDrafts = showDrafts()): BlogPost | null {
  return visiblePosts(includeDrafts).find((p) => p.slug === slug) ?? null
}

export function postsForCity(citySlug: string, includeDrafts = showDrafts()): BlogPost[] {
  return visiblePosts(includeDrafts).filter((p) => p.cities.some((c) => c.slug === citySlug))
}

function blockText(b: BlogBlock): string {
  switch (b.type) {
    case 'p':
    case 'h2':
    case 'tip':
      return b.text
    case 'list':
      return b.items.join(' ')
    case 'facts':
      return b.items.map((i) => `${i.label} ${i.value}`).join(' ')
    case 'image':
      return b.caption ?? ''
  }
}

/** Minutos de leitura (200 palavras por minuto, mínimo 1). */
export function readingMinutes(post: BlogPost): number {
  const words = post.blocks.map(blockText).join(' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/** "20 de novembro de 2026". */
export function formatPostDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y!, m! - 1, d!)))
}

export type InlinePart =
  { kind: 'text' | 'bold'; text: string } | { kind: 'link'; text: string; href: string }

/** **negrito** e [texto](/link) dentro de parágrafos e itens. */
export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = []
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ kind: 'text', text: text.slice(last, m.index) })
    if (m[1] !== undefined) parts.push({ kind: 'bold', text: m[1] })
    else parts.push({ kind: 'link', text: m[2]!, href: m[3]! })
    last = re.lastIndex
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
  return parts
}
