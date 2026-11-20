import type { Metadata } from 'next'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { TipsModeration } from '@/features/blog/components/tips-moderation'
import { canModerateTips, listTipsAdmin } from '@/features/blog/services/tips.service'
import { findPost } from '@/features/blog/posts'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Blog — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminBlogPage() {
  const [user, canModerate] = await Promise.all([getCurrentUser(), canModerateTips()])
  const tips = canModerate ? await listTipsAdmin() : []
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
      subtitle="Dicas dos leitores nos guias: nada aparece no site antes de aprovado"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <Card className="p-6">
        {canModerate ? (
          <TipsModeration tips={tips} titles={titles} />
        ) : (
          <p className="text-muted-foreground text-sm">
            A moderação das dicas é feita por suporte, marketing e master.
          </p>
        )}
      </Card>
    </AdminShell>
  )
}
