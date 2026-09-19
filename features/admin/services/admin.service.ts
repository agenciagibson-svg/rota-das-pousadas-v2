import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { can } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/log'
import {
  getPousadaSlugById,
  getPousadaHeaderById,
  listAllPousadasForAdmin,
  listPendingPousadas,
  listPlatformHosts,
  linkPousadaOwnerRpc,
  setPousadaStatus,
  type PousadaStatus,
} from '@/repositories/admin.repository'
import {
  getPlatformKpis,
  getRevenueByMonth,
  getBookingsByRegion,
  getOccupancyRate,
} from '@/repositories/admin-metrics.repository'
import {
  insertGrant,
  revokeGrant,
  listActiveGrantsByPousada,
} from '@/repositories/platform-access.repository'
import {
  insertPousadaAsAdmin,
  deletePousada,
  getPousadaRepository,
} from '@/repositories/pousadas.repository'
import { getDestinationRepository } from '@/repositories/destinations.repository'
import { insertRoom } from '@/repositories/rooms.repository'
import { uniqueSlug } from '@/lib/slug'
import type {
  AdminPousadaRow,
  PendingPousada,
  PlatformAccessGrant,
  PlatformHost,
  PlatformOverview,
} from '@/features/admin/types'
import type { CreatePousadaAdminInput } from '@/features/admin/schemas'

/** Qualquer papel de plataforma pode visualizar o painel admin. */
async function assertPlatform() {
  const user = await getCurrentUser()
  if (!user?.platformRole) throw new Error('Acesso restrito à equipe da plataforma.')
  return user
}

/** Apenas papéis com permissão de aprovar (comercial/master) mutam o status. */
async function assertCanApprove() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'pousada:approve')) {
    throw new Error('Você não tem permissão para aprovar pousadas.')
  }
  return user
}

/** Só quem pode criar pousada (comercial/master) usa o cadastro rápido do admin. */
async function assertCanCreate() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'pousada:create')) {
    throw new Error('Você não tem permissão para cadastrar pousadas.')
  }
  return user
}

/** Normaliza @handle ou URL do Instagram para uma URL completa (ou '' se vazio). */
function normalizeInstagram(value: string | undefined): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return ''
  const handle = trimmed
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
  return handle ? `https://instagram.com/${handle}` : ''
}

/**
 * Cadastro rápido de pousada pela equipe da plataforma, sem que o
 * proprietário precise ter conta ainda (referência de conteúdo vem do
 * Instagram/contato informado manualmente). Cria a pousada e uma acomodação
 * padrão; se a acomodação falhar, desfaz a pousada para não deixar cadastro
 * pela metade.
 */
export async function createPousadaAsAdmin(
  input: CreatePousadaAdminInput,
): Promise<{ slug: string }> {
  const user = await assertCanCreate()
  const slug = uniqueSlug(input.name)
  const [cover, ...gallery] = input.images

  const pousada = await insertPousadaAsAdmin({
    slug,
    name: input.name,
    city: input.city,
    state: input.state,
    description: input.description,
    pricePerNight: input.pricePerNight,
    instagram: normalizeInstagram(input.instagram),
    image: cover,
    gallery,
    notificationEmail: (input.contactEmail ?? '').trim().toLowerCase(),
    whatsapp: input.whatsapp ?? '',
    status: input.publishNow ? 'publicada' : 'rascunho',
  })

  try {
    await insertRoom({
      pousadaId: pousada.id,
      name: 'Acomodação principal',
      code: null,
      categoryId: null,
      description: 'Acomodação padrão cadastrada pela equipe.',
      operationalDescription: '',
      location: '',
      capacity: 4,
      capacityMax: null,
      adultsMax: null,
      childrenMax: 0,
      infantsAllowed: true,
      petsAllowed: false,
      bedConfig: [],
      accessible: false,
      basePrice: input.pricePerNight,
      publicVisible: true,
      displayOrder: 0,
      internalNotes: '',
      createdBy: user.id,
    })
  } catch (error) {
    await deletePousada(pousada.id)
    throw error
  }

  return { slug: pousada.slug }
}

export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return Boolean(user?.platformRole)
}

export async function listPending(): Promise<PendingPousada[]> {
  await assertPlatform()
  return listPendingPousadas()
}

/** Dados reais da Visão Geral do admin — substitui os KPIs/gráficos fixos. */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  await assertPlatform()

  const [kpis, revenueByMonth, bookingsByRegion, occupancyRate, destinations, pousadasPage] =
    await Promise.all([
      getPlatformKpis(),
      getRevenueByMonth(12),
      getBookingsByRegion(),
      getOccupancyRate(),
      getDestinationRepository().list(),
      getPousadaRepository().list({ pageSize: 5 }),
    ])

  return {
    kpis,
    revenueByMonth,
    bookingsByRegion,
    occupancyRate,
    featuredDestinations: destinations
      .slice(0, 5)
      .map((d) => ({ slug: d.slug, name: d.name, state: d.state, pousadas: d.pousadas })),
    featuredPousadas: pousadasPage.items.map((p) => ({
      slug: p.slug,
      name: p.name,
      city: p.city,
      state: p.state,
      image: p.image,
      rating: p.rating,
    })),
  }
}

/** Todas as pousadas da plataforma (qualquer status), pra tela de gestão. */
export async function listPousadasAdmin(filter?: PousadaStatus): Promise<AdminPousadaRow[]> {
  await assertPlatform()
  return listAllPousadasForAdmin(filter)
}

/** Suspende/reativa/etc. uma pousada — mesma permissão de aprovar (comercial/master). */
export async function changePousadaStatus(id: string, status: PousadaStatus): Promise<void> {
  const user = await assertCanApprove()
  await setPousadaStatus(id, status)
  await logAudit({
    actorId: user.id,
    action: 'pousada.status_changed_by_admin',
    targetTable: 'pousadas',
    targetId: id,
    metadata: { status },
  })
}

/** Anfitriões (proprietários) ativos em toda a plataforma. */
export async function listHostsAdmin(): Promise<PlatformHost[]> {
  await assertPlatform()
  return listPlatformHosts()
}

export async function approvePousada(id: string): Promise<string | null> {
  await assertCanApprove()
  const slug = await getPousadaSlugById(id)
  await setPousadaStatus(id, 'publicada')
  return slug
}

export async function rejectPousada(id: string): Promise<string | null> {
  await assertCanApprove()
  const slug = await getPousadaSlugById(id)
  await setPousadaStatus(id, 'reprovada')
  return slug
}

/** Apenas quem pode gerenciar pousadas da plataforma (comercial/master) vincula proprietário. */
async function assertCanLinkOwner() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'pousada:link_owner')) {
    throw new Error('Você não tem permissão para vincular proprietário.')
  }
  return user
}

/** Papel ativo pode vincular proprietário? Usa pra decidir se mostra o botão, sem lançar erro. */
export async function canLinkOwner(): Promise<boolean> {
  const user = await getCurrentUser()
  return Boolean(user?.platformRole && can(user.platformRole, 'pousada:link_owner'))
}

/**
 * Vincula um e-mail já cadastrado como proprietário ativo de uma pousada sem
 * dono (achado da avaliação de painéis de 15/09/2026: o cadastro rápido do
 * admin cria a pousada sem nenhuma membership, e não havia como vincular o
 * dono depois). RPC `link_pousada_owner` (0052) resolve o e-mail, valida
 * permissão e grava a auditoria dentro da mesma transação.
 */
export async function linkPousadaOwner(input: { pousadaId: string; email: string }): Promise<void> {
  await assertCanLinkOwner()
  await linkPousadaOwnerRpc(input.pousadaId, input.email.trim().toLowerCase())
}

/** Apenas quem pode gerenciar concessões (master) acessa dados sensíveis de forma justificada. */
async function assertCanManageGrants() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'platform:grant:manage')) {
    throw new Error('Você não tem permissão para conceder acesso institucional.')
  }
  return user
}

/** Papel ativo pode conceder/revogar acesso institucional? (`platform:grant:manage` — só master.) Usa pra decidir se mostra o link/tela, sem lançar erro. */
export async function canManageGrants(): Promise<boolean> {
  const user = await getCurrentUser()
  return Boolean(user?.platformRole && can(user.platformRole, 'platform:grant:manage'))
}

/**
 * Dados da tela "Acessos" de uma pousada: nome (cabeçalho) + concessões
 * ativas. UI antes não existia (achado da auditoria de 16/09/2026) — a
 * RPC/service já existiam desde a 0047, só faltava tela pra usar.
 */
export async function getAccessGrantsPageData(
  pousadaId: string,
): Promise<{ pousadaName: string; grants: PlatformAccessGrant[] }> {
  await assertCanManageGrants()
  const [header, grants] = await Promise.all([
    getPousadaHeaderById(pousadaId),
    listActiveGrantsByPousada(pousadaId),
  ])
  if (!header) throw new Error('Pousada não encontrada.')
  return { pousadaName: header.name, grants }
}

/**
 * Concede acesso institucional temporário e justificado a dados sensíveis
 * (reservas/pagamentos/despesas) de uma pousada. Resolve o Conflito A da
 * auditoria: a plataforma deixa de ter acesso automático a esses dados —
 * cada concessão é registrada em auditoria com motivo e prazo de expiração.
 */
export async function grantSensitiveAccess(input: {
  pousadaId: string
  reason: string
  expiresAt: string
}): Promise<{ id: string }> {
  const user = await assertCanManageGrants()
  // `grantedBy` saiu: a RPC `grant_platform_access` (0047) grava `auth.uid()`
  // e registra a auditoria dentro da mesma transação da concessão — evento de
  // auditoria e concessão não podem divergir se um dos dois falhar.
  const grant = await insertGrant({
    pousadaId: input.pousadaId,
    grantedTo: user.id,
    reason: input.reason,
    expiresAt: input.expiresAt,
  })
  return grant
}

/** Revoga uma concessão de acesso institucional antes do vencimento. */
export async function revokeSensitiveAccess(grantId: string): Promise<void> {
  await assertCanManageGrants()
  // Auditoria gravada pela própria RPC (0047), junto com a revogação.
  await revokeGrant(grantId)
}

/** Concessões ativas de uma pousada — visão de auditoria do admin de plataforma. */
export async function listSensitiveAccessGrants(pousadaId: string): Promise<PlatformAccessGrant[]> {
  await assertCanManageGrants()
  return listActiveGrantsByPousada(pousadaId)
}
