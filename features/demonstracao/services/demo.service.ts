import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { can } from '@/lib/auth/rbac'
import { isSupabaseConfigured } from '@/lib/env'
import { rowToPousada, type PublicPousadaRow } from '@/repositories/pousadas.repository'
import {
  createDemoLinkRpc,
  getDemoPousadaRpc,
  listDemoLinksRpc,
  revokeDemoLinkRpc,
  type DemoLinkRow,
} from '@/repositories/demo-links.repository'
import type { Pousada } from '@/types'
import type { PublicRoomInfo } from '@/components/pousada/pousada-sections'
import { isDemoToken, parseDemoResponse, withoutSeedRating } from '../demo'

export type DemoPage =
  { kind: 'published'; slug: string } | { kind: 'demo'; pousada: Pousada; rooms: PublicRoomInfo[] }

/**
 * Abre o link de demonstração. `null` = link inexistente, trocado, desativado
 * ou pousada arquivada (a página mostra "link não encontrado"). Cada abertura
 * é contada no banco (no máximo uma por minuto).
 */
export async function getDemoPage(token: string): Promise<DemoPage | null> {
  if (!isDemoToken(token) || !isSupabaseConfigured()) return null
  const parsed = parseDemoResponse(await getDemoPousadaRpc(token))
  if (!parsed) return null
  if (parsed.kind === 'published') return parsed
  const pousada = withoutSeedRating(
    rowToPousada({ gallery: [], tags: [], ...parsed.pousadaRow } as unknown as PublicPousadaRow),
  )
  return { kind: 'demo', pousada, rooms: parsed.rooms }
}

/** Mesmo grupo que cria e aprova pousada na plataforma: comercial e master. */
async function assertCanManageDemos() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'pousada:approve')) {
    throw new Error('Você não tem permissão para links de demonstração.')
  }
  return user
}

export async function canManageDemoLinks(): Promise<boolean> {
  const user = await getCurrentUser()
  return Boolean(user?.platformRole && can(user.platformRole, 'pousada:approve'))
}

export async function createDemoLink(pousadaId: string, renew: boolean): Promise<string> {
  await assertCanManageDemos()
  return createDemoLinkRpc(pousadaId, renew)
}

export async function revokeDemoLink(pousadaId: string): Promise<void> {
  await assertCanManageDemos()
  await revokeDemoLinkRpc(pousadaId)
}

/** Links por pousada, para a tela de pousadas do /admin. Vazio para quem não pode ver. */
export async function listDemoLinks(): Promise<Record<string, DemoLinkRow>> {
  if (!(await canManageDemoLinks())) return {}
  const rows = await listDemoLinksRpc()
  return Object.fromEntries(rows.map((r) => [r.pousadaId, r]))
}
