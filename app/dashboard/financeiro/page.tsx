import { getCurrentUser, getOwnerPousada, getFinance } from '@/server/queries'
import { FinanceView } from '@/features/financeiro'

export default async function DashboardFinanceiroPage() {
  const [user, pousada, finance] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getFinance(),
  ])

  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <FinanceView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      summary={finance.summary}
      transactions={finance.transactions}
    />
  )
}
