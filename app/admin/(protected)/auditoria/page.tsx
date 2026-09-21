import type { Metadata } from 'next'
import { ShieldOff } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { AuditLogView } from '@/features/admin/components/audit-log-view'
import { LoginAttemptsView } from '@/features/admin/components/login-attempts-view'
import {
  listAuditLogAdmin,
  canViewAuditLog,
  listLoginAttemptsAdmin,
  canViewLoginAttempts,
} from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Auditoria — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; from?: string; to?: string; loginEmail?: string }>
}) {
  const { action, from, to, loginEmail } = await searchParams
  const [user, canView, canViewLogins] = await Promise.all([
    getCurrentUser(),
    canViewAuditLog(),
    canViewLoginAttempts(),
  ])
  const [entries, loginAttempts] = await Promise.all([
    canView ? listAuditLogAdmin({ action, from, to }) : Promise.resolve([]),
    canViewLogins ? listLoginAttemptsAdmin({ email: loginEmail }) : Promise.resolve([]),
  ])

  return (
    <AdminShell
      active="auditoria"
      title="Auditoria"
      subtitle="Trilha de eventos sensíveis e tentativas de login da plataforma"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <div className="space-y-6">
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

        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-foreground font-serif text-lg font-semibold">
              Tentativas de login
            </h3>
            <p className="text-muted-foreground text-sm">
              Janela recente (~24h) · IP sempre mascarado por privacidade
            </p>
          </div>
          {canViewLogins ? (
            <LoginAttemptsView initialAttempts={loginAttempts} />
          ) : (
            <EmptyState
              icon={ShieldOff}
              title="Acesso restrito"
              description="O relatório de login é exclusivo do master."
            />
          )}
        </Card>
      </div>
    </AdminShell>
  )
}
