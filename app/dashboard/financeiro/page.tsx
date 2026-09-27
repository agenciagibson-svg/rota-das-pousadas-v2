import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { ShieldAlert } from 'lucide-react'
import {
  canManageExpenses,
  canViewFinance,
  getCurrentUser,
  getFinance,
  getOwnerPousada,
} from '@/server/queries'
import { FinanceView } from '@/features/financeiro'
import { EmptyState } from '@/components/ui/empty-state'

export default async function DashboardFinanceiroPage() {
  if (await sectionDenied('financeiro'))
    return <NoSectionAccess section="financeiro" title="Financeiro" />

  const [user, pousada, allowed] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    canViewFinance(),
  ])

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <EmptyState
          size="lg"
          icon={ShieldAlert}
          title="Sem acesso ao financeiro"
          description="Seu papel nesta pousada não inclui receitas e despesas. Fale com o proprietário se precisar."
        />
      </div>
    )
  }

  const [finance, canEdit] = await Promise.all([getFinance(), canManageExpenses()])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <FinanceView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      summary={finance.summary}
      transactions={finance.transactions}
      canManageExpenses={canEdit}
    />
  )
}
