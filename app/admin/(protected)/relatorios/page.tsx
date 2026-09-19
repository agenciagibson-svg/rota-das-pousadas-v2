import type { Metadata } from 'next'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { ReportsView } from '@/features/admin/components/reports-view'
import { getReportsData } from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Relatórios — Admin',
  robots: { index: false, follow: false },
}

const VALID_MONTHS = [3, 6, 12, 24]

export default async function AdminRelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>
}) {
  const { months: monthsParam } = await searchParams
  const months = VALID_MONTHS.includes(Number(monthsParam)) ? Number(monthsParam) : 12

  const [user, data] = await Promise.all([getCurrentUser(), getReportsData(months)])

  return (
    <AdminShell
      active="relatorios"
      title="Relatórios"
      subtitle="Exportações e análises detalhadas"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <ReportsView
        months={months}
        kpis={data.kpis}
        gmvByMonth={data.gmvByMonth}
        bookingsByRegion={data.bookingsByRegion}
        occupancyRate={data.occupancyRate}
      />
    </AdminShell>
  )
}
