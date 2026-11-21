import { ogCard, OG_SIZE } from '@/lib/og-card'
import { findPost, readingMinutes } from '@/features/blog/posts'
import { listHiddenPostSlugs } from '@/repositories/blog-hidden-posts.repository'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'Guia de viagem da Rota das Pousadas'

/** Prévia do link do texto do blog: foto de capa, título e lugar. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = findPost(slug, undefined, await listHiddenPostSlugs())
  if (!post) return ogCard({ title: 'Rota das Pousadas', subtitle: 'Guias de viagem' })
  return ogCard({
    photo: post.cover.src,
    title: post.title,
    subtitle: post.place,
    badges: ['Guia de viagem', `${readingMinutes(post)} min de leitura`],
  })
}
