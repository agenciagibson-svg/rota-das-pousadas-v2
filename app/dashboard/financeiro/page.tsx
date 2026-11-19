import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { ShieldAlert } from 'lucide-react'
import {
  canManageExpenses,
  canViewFinance,
  getCurrentUser,
  getFinance,
  getOwnerCommissionStatement,
  getOwnerPousada,
} from '@/server/queries'
import { CommissionStatementCard } from '@/features/comissao/components/commission-statement-card'
import { parseMonthParam } from '@/features/comissao'
import { FinanceView } from '@/features/financeiro'
import { EmptyState } from '@/components/ui/empty-state'

export default async function DashboardFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>
}) {
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

  const { mes } = await searchParams
  const [finance, canEdit, commission] = await Promise.all([
    getFinance(),
    canManageExpenses(),
    // O extrato da comissão não pode derrubar o Financeiro: sem leitura, o bloco some.
    getOwnerCommissionStatement(parseMonthParam(mes)).catch((error: unknown) => {
      console.error('[financeiro] falha ao ler o extrato de comissão', error)
      return null
    }),
  ])
  // Só aparece para pousada com contrato aceito (ou que já tenha comissão registrada).
  const showCommission = commission && (commission.hasContract || commission.months.length > 0)
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <FinanceView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      summary={finance.summary}
      transactions={finance.transactions}
      canManageExpenses={canEdit}
    >
      {showCommission && (
        <CommissionStatementCard statement={commission} basePath="/dashboard/financeiro" />
      )}
    </FinanceView>
  )
}
