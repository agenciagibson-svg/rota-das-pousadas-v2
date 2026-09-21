import type { Metadata } from 'next'
import { ShieldOff } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PlatformFinance } from '@/features/admin/components/platform-finance'
import { BillingOverview } from '@/features/admin/components/billing-overview'
import {
  listPlatformExpensesAdmin,
  canManagePlatformFinance,
  getPlatformPlanStatus,
  getBillingOverview,
} from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Financeiro — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminFinanceiroPage() {
  const [user, canManage] = await Promise.all([getCurrentUser(), canManagePlatformFinance()])
  const [expenses, planStatus, billing] = canManage
    ? await Promise.all([
        listPlatformExpensesAdmin(),
        getPlatformPlanStatus(),
        getBillingOverview(),
      ])
    : [[], null, null]

  return (
    <AdminShell
      active="financeiro"
      title="Financeiro"
      subtitle="Contas a pagar da própria Rota e cobrança de assinatura"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <div className="space-y-6">
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

        {canManage && billing && (
          <BillingOverview
            metrics={billing.metrics}
            cashFlow={billing.cashFlow}
            receivables={billing.receivables}
            recentInvoices={billing.recentInvoices}
          />
        )}
      </div>
    </AdminShell>
  )
}
