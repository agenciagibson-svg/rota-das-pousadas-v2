import type { Metadata } from 'next'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { ReportsView } from '@/features/admin/components/reports-view'
import { REPORT_PERIODS, type ReportPeriod } from '@/features/admin/report-metrics'
import { getReportsData } from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'
import { parseMonthParam } from '@/features/comissao'
import { PlatformChannelsCard } from '@/features/origem/components/platform-channels-card'
import { getPlatformBookingChannels } from '@/features/origem/services/origin.service'

export const metadata: Metadata = {
  title: 'Relatórios — Admin',
  robots: { index: false, follow: false },
}

/** Links antigos usavam ?months=3|6|12|24. */
const FROM_MONTHS: Record<string, ReportPeriod> = {
  '3': '90d',
  '6': '6m',
  '12': '12m',
  '24': '24m',
}

export default async function AdminRelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; months?: string; canal?: string | string[] }>
}) {
  const { period: periodParam, months, canal } = await searchParams
  const period: ReportPeriod = (REPORT_PERIODS as readonly string[]).includes(periodParam ?? '')
    ? (periodParam as ReportPeriod)
    : (FROM_MONTHS[months ?? ''] ?? '90d')

  const [user, data, channels] = await Promise.all([
    getCurrentUser(),
    getReportsData(period),
    // 0106: reservas por canal; some se a RPC ainda não existir.
    getPlatformBookingChannels(parseMonthParam(canal)).catch((error: unknown) => {
      console.error('[admin] falha ao ler as reservas por canal', error)
      return null
    }),
  ])

  return (
    <AdminShell
      active="relatorios"
      title="Relatórios"
      subtitle="Desempenho da rede por período, região e pousada"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <ReportsView data={data} />
      {channels && <PlatformChannelsCard data={channels} />}
    </AdminShell>
  )
}
