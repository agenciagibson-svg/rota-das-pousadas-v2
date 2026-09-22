/**
 * Pousadas — camada de aplicação (regras de negócio + orquestração).
 *
 * Delega o acesso a dados ao Repository (única porta ao banco). Regras de
 * negócio futuras (elegibilidade, ordenação por relevância, disponibilidade)
 * entram AQUI, nunca no Repository nem na UI.
 */
import 'server-only'
import { getPousadaRepository } from '@/repositories/pousadas.repository'
import { listPublicReviewsByPousada, type PublicReviewRow } from '@/repositories/reviews.repository'
import { isSupabaseConfigured } from '@/lib/env'
import type { ListQuery, Paginated, Pousada } from '@/types'
import { parseCatalogQuery } from '@/features/pousadas/search'

export async function listPousadas(query: ListQuery = {}): Promise<Paginated<Pousada>> {
  return getPousadaRepository().list(parseCatalogQuery(query))
}

export async function getPousadaBySlug(slug: string): Promise<Pousada | null> {
  return getPousadaRepository().findBySlug(slug)
}

export async function listPousadaSlugs(): Promise<string[]> {
  return getPousadaRepository().listSlugs()
}

/**
 * Avaliações públicas de uma pousada, pra página de detalhe. Sem `id` (modo
 * demonstração, ou pousada ainda sem UUID resolvido) retorna vazio — nunca
 * inventa avaliação de exemplo.
 */
export async function listPublicReviews(
  pousadaId: string | undefined,
  limit = 6,
): Promise<PublicReviewRow[]> {
  if (!pousadaId || !isSupabaseConfigured()) return []
  return listPublicReviewsByPousada(pousadaId, limit)
}

/** Pousadas relacionadas (exclui a atual). Usado na página de detalhe. */
export async function listNearbyPousadas(slug: string, limit = 3): Promise<Pousada[]> {
  return getPousadaRepository().listExcluding(slug, limit)
}
