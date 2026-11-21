import type { Metadata } from 'next'
import Link from 'next/link'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { GuidesAdmin } from '@/features/blog/components/guides-admin'
import { TipsModeration } from '@/features/blog/components/tips-moderation'
import { listGuidesAdmin } from '@/features/blog/services/guides.service'
import { canModerateTips, listTipsAdmin } from '@/features/blog/services/tips.service'
import { findPost } from '@/features/blog/posts'
import { cn } from '@/lib/utils'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Blog — Admin',
  robots: { index: false, follow: false },
}

const VIEWS = [
  { key: 'guias', label: 'Guias' },
  { key: 'dicas', label: 'Dicas dos leitores' },
] as const

/**
 * Blog no painel: os guias (situação, tirar do ar / voltar, 0113) e a
 * moderação das dicas dos leitores (0108).
 */
export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  const { ver } = await searchParams
  const view = ver === 'dicas' ? 'dicas' : 'guias'
  const [user, canModerate] = await Promise.all([getCurrentUser(), canModerateTips()])
  const [tips, guides] = canModerate
    ? await Promise.all([listTipsAdmin(), listGuidesAdmin()])
    : [[], []]
  const pendingTips = tips.filter((t) => t.status === 'pendente').length
  const titles = Object.fromEntries(
    [...new Set(tips.map((t) => t.postSlug))].map((slug) => [
      slug,
      findPost(slug, true)?.title ?? slug,
    ]),
  )

  return (
    <AdminShell
      active="blog"
      title="Blog"
      subtitle="Guias publicados e dicas dos leitores (nada aparece no site antes de aprovado)"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      {canModerate ? (
        <>
          <nav aria-label="Blog" className="mb-4 flex gap-2">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={v.key === 'guias' ? '/admin/blog' : '/admin/blog?ver=dicas'}
                aria-current={view === v.key ? 'page' : undefined}
                className={cn(
                  'inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition',
                  view === v.key
                    ? 'bg-foreground text-background'
                    : 'bg-card text-foreground hover:bg-secondary',
                )}
              >
                {v.label}
                {v.key === 'guias' && ` (${guides.length})`}
                {v.key === 'dicas' && pendingTips > 0 && ` (${pendingTips} para revisar)`}
              </Link>
            ))}
          </nav>
          <Card className="p-6">
            {view === 'guias' ? (
              <GuidesAdmin guides={guides} />
            ) : (
              <TipsModeration tips={tips} titles={titles} />
            )}
          </Card>
        </>
      ) : (
        <Card className="p-6">
          <p className="text-muted-foreground text-sm">
            O blog é cuidado por suporte, marketing e master.
          </p>
        </Card>
      )}
    </AdminShell>
  )
}
