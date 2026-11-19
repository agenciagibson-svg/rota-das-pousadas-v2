import type { Metadata } from 'next'
import { ShieldOff } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PlatformFinance } from '@/features/admin/components/platform-finance'
import { PlatformCommissionsCard } from '@/features/comissao/components/platform-commissions-card'
import { listPlatformCommissions } from '@/features/comissao/services/commission.service'
import { parseMonthParam } from '@/features/comissao'
import { PlatformPixAuditCard } from '@/features/pagamentos/components/platform-pix-audit-card'
import { listPlatformPixProofs } from '@/features/pagamentos/services/pix.service'
import {
  listPlatformExpensesAdmin,
  canManagePlatformFinance,
} from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Financeiro — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[]; pix?: string | string[] }>
}) {
  const { mes, pix } = await searchParams
  const [user, canManage] = await Promise.all([getCurrentUser(), canManagePlatformFinance()])
  // Modelo v1.2 (19/11/2026): a receita da Rota é a comissão por reserva. O
  // plano de assinatura, o MRR e as faturas de assinatura saíram desta tela.
  const [expenses, commissions, pixAudit] = canManage
    ? await Promise.all([
        listPlatformExpensesAdmin(),
        // `null` = não deu para ler (ex.: migration 0104 ainda não aplicada): o bloco some.
        listPlatformCommissions(parseMonthParam(mes)).catch((error: unknown) => {
          console.error('[admin] falha ao ler as comissões', error)
          return null
        }),
        // 0105: comprovantes de Pix de todas as pousadas; some se a RPC faltar.
        listPlatformPixProofs(parseMonthParam(pix)).catch((error: unknown) => {
          console.error('[admin] falha ao ler os comprovantes de Pix', error)
          return null
        }),
      ])
    : [[], null, null]

  return (
    <AdminShell
      active="financeiro"
      title="Financeiro"
      subtitle="Comissões das reservas e contas a pagar da própria Rota"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <div className="space-y-6">
        {canManage && commissions && (
          <PlatformCommissionsCard data={commissions} basePath="/admin/financeiro" />
        )}

        {canManage && pixAudit && (
          <PlatformPixAuditCard data={pixAudit} basePath="/admin/financeiro" />
        )}

        <Card className="p-6">
          {canManage ? (
            <PlatformFinance initialExpenses={expenses} planStatus={null} />
          ) : (
            <EmptyState
              icon={ShieldOff}
              title="Acesso restrito"
              description="O financeiro da plataforma é exclusivo de financeiro_plataforma/master."
            />
          )}
        </Card>
      </div>
    </AdminShell>
  )
}
