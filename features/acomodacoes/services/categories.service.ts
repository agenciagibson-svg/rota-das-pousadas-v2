import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { requireCapability } from './access'
import { logAudit } from '@/lib/audit/log'
import {
  listCategoriesByPousada,
  getCategoryById,
  insertCategory,
  updateCategory,
  setCategoryStatus,
} from '@/repositories/categories.repository'
import type { AccommodationCategory } from '@/features/acomodacoes/types'
import type { CategoryInput } from '@/features/acomodacoes/schemas'

export async function listCategories(): Promise<AccommodationCategory[]> {
  const { pousadaId } = await requireCapability('room:status:view')
  return listCategoriesByPousada(pousadaId)
}

async function requireCategoryInActivePousada(id: string, pousadaId: string) {
  const category = await getCategoryById(id)
  if (!category || category.pousadaId !== pousadaId) throw new Error('Categoria não encontrada nesta pousada.')
  return category
}

export async function addCategory(input: CategoryInput): Promise<void> {
  const { pousadaId } = await requireCapability('category:manage')
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')

  let id: string
  try {
    const result = await insertCategory({
      pousadaId,
      name: input.name,
      code: input.code || null,
      description: input.description ?? '',
      defaultCapacity: input.defaultCapacity,
      maxCapacity: input.maxCapacity ?? null,
      defaultBedCount: input.defaultBedCount,
      basePriceSuggestion: input.basePriceSuggestion ?? null,
      displayOrder: input.displayOrder,
      createdBy: user.id,
    })
    id = result.id
  } catch {
    throw new Error('Já existe uma categoria com esse nome ou código nesta pousada.')
  }

  await logAudit({
    actorId: user.id,
    action: 'category.created',
    targetTable: 'accommodation_categories',
    targetId: id,
    metadata: { pousadaId, name: input.name },
  })
}

export async function editCategory(id: string, input: CategoryInput): Promise<void> {
  const { pousadaId } = await requireCapability('category:manage')
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')
  await requireCategoryInActivePousada(id, pousadaId)

  await updateCategory(id, {
    name: input.name,
    code: input.code || null,
    description: input.description ?? '',
    defaultCapacity: input.defaultCapacity,
    maxCapacity: input.maxCapacity ?? null,
    defaultBedCount: input.defaultBedCount,
    basePriceSuggestion: input.basePriceSuggestion ?? null,
    displayOrder: input.displayOrder,
  })

  await logAudit({
    actorId: user.id,
    action: 'category.updated',
    targetTable: 'accommodation_categories',
    targetId: id,
    metadata: { pousadaId },
  })
}

/** Inativa — categoria usada não pode ser excluída fisicamente. */
export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  const { pousadaId } = await requireCapability('category:manage')
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')
  await requireCategoryInActivePousada(id, pousadaId)

  await setCategoryStatus(id, active ? 'active' : 'inactive')
  await logAudit({
    actorId: user.id,
    action: active ? 'category.reactivated' : 'category.inactivated',
    targetTable: 'accommodation_categories',
    targetId: id,
    metadata: { pousadaId },
  })
}
