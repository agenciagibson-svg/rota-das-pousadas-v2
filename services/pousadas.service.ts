/**
 * Pousadas — camada de aplicação (regras de negócio + orquestração).
 *
 * Delega o acesso a dados ao Repository (única porta ao banco). Regras de
 * negócio futuras (elegibilidade, ordenação por relevância, disponibilidade)
 * entram AQUI, nunca no Repository nem na UI.
 */
import 'server-only'
import { getPousadaRepository } from '@/repositories/pousadas.repository'
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

/** Pousadas relacionadas (exclui a atual). Usado na página de detalhe. */
export async function listNearbyPousadas(slug: string, limit = 3): Promise<Pousada[]> {
  return getPousadaRepository().listExcluding(slug, limit)
}
