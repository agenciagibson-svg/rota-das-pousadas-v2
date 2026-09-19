import type { Metadata } from 'next'
import { ShieldOff } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { AuditLogView } from '@/features/admin/components/audit-log-view'
import { listAuditLogAdmin, canViewAuditLog } from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Auditoria — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; from?: string; to?: string }>
}) {
  const { action, from, to } = await searchParams
  const [user, canView] = await Promise.all([getCurrentUser(), canViewAuditLog()])
  const entries = canView ? await listAuditLogAdmin({ action, from, to }) : []

  return (
    <AdminShell
      active="auditoria"
      title="Auditoria"
      subtitle="Trilha de eventos sensíveis de toda a plataforma"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <Card className="p-6">
        {canView ? (
          <AuditLogView initialEntries={entries} />
        ) : (
          <EmptyState
            icon={ShieldOff}
            title="Acesso restrito"
            description="A auditoria da plataforma é exclusiva do master."
          />
        )}
      </Card>
    </AdminShell>
  )
}
