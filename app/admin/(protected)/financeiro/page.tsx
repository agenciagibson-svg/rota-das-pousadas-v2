import type { Metadata } from 'next'
import { ShieldOff } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PlatformFinance } from '@/features/admin/components/platform-finance'
import {
  listPlatformExpensesAdmin,
  canManagePlatformFinance,
  getPlatformPlanStatus,
} from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Financeiro — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminFinanceiroPage() {
  const [user, canManage] = await Promise.all([getCurrentUser(), canManagePlatformFinance()])
  const [expenses, planStatus] = canManage
    ? await Promise.all([listPlatformExpensesAdmin(), getPlatformPlanStatus()])
    : [[], null]

  return (
    <AdminShell
      active="financeiro"
      title="Financeiro"
      subtitle="Contas a pagar da própria Rota e cobrança de assinatura"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <Card className="p-6">
        {canManage ? (
          <PlatformFinance initialExpenses={expenses} planStatus={planStatus} />
        ) : (
          <EmptyState
            icon={ShieldOff}
            title="Acesso restrito"
            description="O financeiro da plataforma é exclusivo de financeiro_plataforma/master."
          />
        )}
      </Card>
    </AdminShell>
  )
}
