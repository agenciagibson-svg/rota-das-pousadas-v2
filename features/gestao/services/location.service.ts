import 'server-only'
import { getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/log'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { geocodeAddress, type GeocodeResult } from '@/lib/geo/nominatim'
import { isInsideBrazil, roundPoint } from '@/lib/geo/coordinates'
import { getPousadaSettings, updatePousadaLocation } from '@/repositories/management.repository'
import type { GeoPoint } from '@/types'
import { getOwnerPousada } from './pms.service'

/**
 * Ponto da pousada no mapa (h8). Mesma permissão das Configurações
 * (`pousada:edit` — proprietário e gestor; a plataforma entra pelo acesso
 * concedido). O banco repete a regra (RLS `pousadas_update` + guarda de
 * colunas + checagens da 0095) para quem chamar a API direto.
 */
async function requireEditablePousada() {
  const [pousada, role, user] = await Promise.all([
    getOwnerPousada(),
    getActiveTenantRole(),
    getCurrentUser(),
  ])
  if (!pousada || !user) throw new Error('Nenhuma pousada sob sua gestão.')
  if (!role || !can(role, 'pousada:edit')) {
    throw new Error('Você não tem permissão para editar a localização da pousada.')
  }
  return { pousada, user }
}

/**
 * "Buscar pelo endereço": geocodifica o endereço SALVO da pousada (não um
 * texto vindo do navegador — assim o servidor não vira um buscador de
 * endereços aberto para qualquer conta).
 */
export async function geocodeOwnerPousadaAddress(): Promise<GeocodeResult> {
  const { pousada } = await requireEditablePousada()
  const settings = await getPousadaSettings(pousada.id)
  if (!settings) throw new Error('Nenhuma pousada sob sua gestão.')
  return geocodeAddress({
    address: settings.address,
    cep: settings.cep,
    city: settings.city,
    state: settings.state,
  })
}

/** Grava (ou apaga, com `null`) o ponto marcado no mapa. */
export async function updateOwnerPousadaLocation(point: GeoPoint | null): Promise<GeoPoint | null> {
  const { pousada, user } = await requireEditablePousada()
  // O schema da action já validou; aqui é a segunda barreira (e o arredondamento).
  if (point && !isInsideBrazil(point)) throw new Error('O ponto precisa ficar dentro do Brasil.')
  const saved = point ? roundPoint(point) : null
  await updatePousadaLocation(pousada.id, saved)
  await logAudit({
    actorId: user.id,
    action: saved ? 'pousada.location_updated' : 'pousada.location_removed',
    targetTable: 'pousadas',
    targetId: pousada.id,
  })
  return saved
}
