import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { can } from '@/lib/auth/rbac'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { loadReportInput } from '@/repositories/admin-reports.repository'
import {
  addActivityRpc,
  getGrowthProfile,
  getGrowthStatusRpc,
  listActivities,
  listCampaignBookings,
  listGrowthProfiles,
  listOpportunities,
  requestGrowthHelpRpc,
  saveOpportunityRpc,
  type GrowthStatus,
} from '@/repositories/growth.repository'
import { buildReport, type PousadaRow, type ReportPeriod } from '../report-metrics'
import {
  campaignResults,
  diagnose,
  offerMessage,
  profileIssues,
  type Activity,
  type CampaignResult,
  type Diagnosis,
  type GrowthProfile,
  type GrowthStage,
  type Issue,
  type Opportunity,
} from '../growth'

async function assertGrowth() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'growth:manage')) {
    throw new Error('Você não tem permissão para ver o plano de ação.')
  }
  return user
}

export async function canManageGrowth(): Promise<boolean> {
  const user = await getCurrentUser()
  return Boolean(user?.platformRole && can(user.platformRole, 'growth:manage'))
}

function todaySaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export type GrowthItem = {
  row: PousadaRow
  profile: GrowthProfile | null
  opportunity: Opportunity | null
  diagnosis: Diagnosis
  activities: Activity[]
  offerText: string
  campaign: { elapsedDays: number; checkpoints: CampaignResult[] } | null
}

export type GrowthBoard = {
  period: ReportPeriod
  today: string
  items: GrowthItem[]
  summary: {
    askedHelp: number
    toOffer: number
    fixProfile: number
    negotiating: number
    activeCampaigns: number
    serviceMrr: number
    contactsDue: number
    byStage: Record<GrowthStage, number>
  }
}

export async function getGrowthBoard(period: ReportPeriod = '90d'): Promise<GrowthBoard> {
  await assertGrowth()
  const [input, profiles, opps, activities] = await Promise.all([
    loadReportInput(period),
    listGrowthProfiles(),
    listOpportunities(),
    listActivities(),
  ])
  const report = buildReport(input)
  const today = todaySaoPaulo()
  const profileBy = new Map(profiles.map((p) => [p.pousadaId, p]))
  const oppBy = new Map(opps.map((o) => [o.pousadaId, o]))
  const actsBy = new Map<string, Activity[]>()
  for (const a of activities) {
    const list = actsBy.get(a.pousadaId) ?? []
    if (list.length < 40) list.push(a)
    actsBy.set(a.pousadaId, list)
  }

  // Resultado das campanhas: reservas desde 90 dias antes do início mais antigo.
  const withCampaign = opps.filter((o) => o.campaignStart)
  const since = withCampaign.reduce<string | null>(
    (min, o) => (!min || o.campaignStart! < min ? o.campaignStart! : min),
    null,
  )
  const campaignBookings = since
    ? await listCampaignBookings(
        withCampaign.map((o) => o.pousadaId),
        new Date(Date.parse(`${since}T00:00:00Z`) - 90 * 86_400_000).toISOString(),
      )
    : []

  const items: GrowthItem[] = report.pousadas.map((row) => {
    const profile = profileBy.get(row.id) ?? null
    const opportunity = oppBy.get(row.id) ?? null
    const diagnosis: Diagnosis = profile
      ? diagnose(row, profile, opportunity)
      : {
          issues: [] as Issue[],
          recommendation: 'acompanhar',
          priority: 0,
          reason: 'Sem dados de perfil.',
        }
    const campaign = opportunity?.campaignStart
      ? campaignResults({
          bookings: campaignBookings.filter((b) => b.pousadaId === row.id),
          rooms: row.rooms,
          start: opportunity.campaignStart,
          end: opportunity.campaignEnd,
          today,
          serviceFee: opportunity.serviceFee,
          adBudget: opportunity.adBudget,
        })
      : null
    return {
      row,
      profile,
      opportunity,
      diagnosis,
      activities: actsBy.get(row.id) ?? [],
      offerText: offerMessage(profile?.ownerName ?? null, row.name, diagnosis),
      campaign,
    }
  })

  const stageOf = (i: GrowthItem): GrowthStage => i.opportunity?.stage ?? 'a_oferecer'
  // Quem pediu ajuda primeiro, depois contatos vencidos, depois prioridade.
  items.sort((a, b) => {
    const askA = a.opportunity?.ownerInterestAt && stageOf(a) === 'interessado' ? 1 : 0
    const askB = b.opportunity?.ownerInterestAt && stageOf(b) === 'interessado' ? 1 : 0
    if (askA !== askB) return askB - askA
    const dueA = a.opportunity?.nextContact && a.opportunity.nextContact <= today ? 1 : 0
    const dueB = b.opportunity?.nextContact && b.opportunity.nextContact <= today ? 1 : 0
    if (dueA !== dueB) return dueB - dueA
    return b.diagnosis.priority - a.diagnosis.priority || a.row.name.localeCompare(b.row.name)
  })

  const byStage = Object.fromEntries(
    (
      [
        'a_oferecer',
        'oferecido',
        'interessado',
        'aceito',
        'campanha_ativa',
        'encerrado',
        'recusado',
      ] as GrowthStage[]
    ).map((s) => [s, items.filter((i) => stageOf(i) === s).length]),
  ) as Record<GrowthStage, number>

  return {
    period,
    today,
    items,
    summary: {
      askedHelp: items.filter((i) => i.opportunity?.ownerInterestAt && stageOf(i) === 'interessado')
        .length,
      toOffer: items.filter(
        (i) => i.diagnosis.recommendation === 'trafego' && stageOf(i) === 'a_oferecer',
      ).length,
      fixProfile: items.filter((i) => i.diagnosis.recommendation === 'arrumar_perfil').length,
      negotiating: items.filter((i) => ['oferecido', 'interessado', 'aceito'].includes(stageOf(i)))
        .length,
      activeCampaigns: byStage.campanha_ativa,
      serviceMrr: items
        .filter((i) => ['aceito', 'campanha_ativa'].includes(stageOf(i)))
        .reduce((s, i) => s + (i.opportunity?.serviceFee ?? 0), 0),
      contactsDue: items.filter(
        (i) => i.opportunity?.nextContact && i.opportunity.nextContact <= today,
      ).length,
      byStage,
    },
  }
}

export async function saveOpportunity(input: Parameters<typeof saveOpportunityRpc>[0]) {
  await assertGrowth()
  await saveOpportunityRpc(input)
}

export async function addActivity(pousadaId: string, kind: 'nota' | 'contato', body: string) {
  await assertGrowth()
  await addActivityRpc(pousadaId, kind, body)
}

// ---------------------------------------------------------------------------
// Painel da pousada
// ---------------------------------------------------------------------------
export type OwnerGrowthCard = {
  status: GrowthStatus
  checklist: { key: string; label: string; ok: boolean }[]
} | null

/** Convite "Quer vender mais?" — só para quem administra a pousada. */
export async function getOwnerGrowthCard(): Promise<OwnerGrowthCard> {
  const [pousadaId, role] = await Promise.all([getActivePousadaId(), getActiveTenantRole()])
  if (!pousadaId || !role || !can(role, 'pousada:edit')) return null
  try {
    const [status, profile] = await Promise.all([
      getGrowthStatusRpc(pousadaId),
      getGrowthProfile(pousadaId),
    ])
    const issues = profile ? profileIssues(profile) : []
    const has = (k: string) => !issues.some((i) => i.key === k)
    return {
      status,
      checklist: [
        { key: 'fotos', label: 'Pelo menos 5 fotos, com capa', ok: has('fotos') && has('capa') },
        { key: 'descricao', label: 'Descrição completa da pousada', ok: has('descricao') },
        { key: 'pagamento', label: 'Pagamento online (Pix ou Mercado Pago)', ok: has('pagamento') },
        { key: 'avaliacoes', label: 'Avaliações de hóspedes', ok: has('avaliacoes') },
      ],
    }
  } catch (e) {
    console.error('[growth] convite do painel', e)
    return null
  }
}

export async function requestGrowthHelp() {
  const [pousadaId, role] = await Promise.all([getActivePousadaId(), getActiveTenantRole()])
  if (!pousadaId || !role || !can(role, 'pousada:edit')) {
    throw new Error('Só o proprietário ou o administrador da pousada pode pedir.')
  }
  return requestGrowthHelpRpc(pousadaId)
}
