import {
  canManageQuotes,
  getCurrentUser,
  getLinkReport,
  getOwnerPousada,
  getQuoteRequests,
} from '@/server/queries'
import { publicEnv } from '@/lib/env'
import { LinkReportView } from '@/features/bio/components/link-report-view'

/** Só as janelas oferecidas na tela — qualquer outra coisa vira 30 dias. */
function parseDays(raw: string | undefined): 7 | 30 | 90 {
  const n = Number(raw)
  return n === 7 || n === 90 ? n : 30
}

export default async function DashboardLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>
}) {
  const { dias } = await searchParams
  const days = parseDays(dias)

  const [user, pousada, report, quotes, canManage] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getLinkReport(days),
    getQuoteRequests(),
    canManageQuotes(),
  ])

  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <LinkReportView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      bioUrl={`${publicEnv.siteUrl}/${pousada?.slug ?? ''}`}
      report={report}
      quotes={quotes}
      canManage={canManage}
      days={days}
    />
  )
}
