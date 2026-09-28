import type { Metadata } from 'next'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { GrowthBoardView } from '@/features/admin/components/growth-board'
import { REPORT_PERIODS, type ReportPeriod } from '@/features/admin/report-metrics'
import { canManageGrowth, getGrowthBoard } from '@/features/admin/services/growth.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Plano de ação — Admin',
  robots: { index: false, follow: false },
}

const PERIODS: ReportPeriod[] = ['30d', '90d', '6m']

export default async function AdminPlanoDeAcaoPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: p } = await searchParams
  const period: ReportPeriod =
    (REPORT_PERIODS as readonly string[]).includes(p ?? '') && PERIODS.includes(p as ReportPeriod)
      ? (p as ReportPeriod)
      : '90d'
  const user = await getCurrentUser()
  const allowed = await canManageGrowth()

  return (
    <AdminShell
      active="plano"
      title="Plano de ação"
      subtitle="Diagnóstico de cada pousada e oferta de tráfego pago"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      {allowed ? (
        <GrowthBoardView board={await getGrowthBoard(period)} periods={PERIODS} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Seu perfil não tem acesso ao plano de ação. Fale com o master da plataforma.
        </p>
      )}
    </AdminShell>
  )
}
