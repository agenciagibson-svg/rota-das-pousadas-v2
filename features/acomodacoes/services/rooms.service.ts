import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { requireCapability } from './access'
import { logAudit } from '@/lib/audit/log'
import {
  listRoomsByPousada,
  listRoomsForHousekeeping,
  getRoomById,
  insertRoom,
  updateRoom,
  setRoomStatus,
  setRoomAmenities,
  updateRoomOperationalStatus,
} from '@/repositories/rooms.repository'
import type { HousekeepingRoom, ManagedRoom } from '@/features/acomodacoes/types'
import type { RoomInput } from '@/features/acomodacoes/schemas'

/**
 * [Ciclo 3B] Só para proprietario/admin_pousada/recepcionista — os únicos
 * papéis com `auth_has_room_read_access` na RLS. Governança usa
 * `getHousekeepingRooms` (RPC de projeção mínima), nunca esta função —
 * chamar isto como Governança já falharia na RLS mesmo se o app tentasse.
 */
export async function getOwnerRooms(): Promise<ManagedRoom[]> {
  const { pousadaId } = await requireCapability('room:status:view')
  return listRoomsByPousada(pousadaId, false)
}

/** Projeção operacional mínima — a única leitura de `rooms` que Governança usa. */
export async function getHousekeepingRooms(): Promise<HousekeepingRoom[]> {
  const { pousadaId } = await requireCapability('room:status:view')
  return listRoomsForHousekeeping(pousadaId)
}

async function requireRoomInActivePousada(id: string, pousadaId: string) {
  const room = await getRoomById(id)
  if (!room || room.pousadaId !== pousadaId)
    throw new Error('Acomodação não encontrada nesta pousada.')
  return room
}

export async function addRoom(input: RoomInput): Promise<void> {
  const { pousadaId } = await requireCapability('room:manage')
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')

  const { id } = await insertRoom({
    pousadaId,
    name: input.name,
    code: input.code || null,
    categoryId: input.categoryId || null,
    description: input.description ?? '',
    operationalDescription: input.operationalDescription ?? '',
    location: input.location ?? '',
    capacity: input.capacity,
    capacityMax: input.capacityMax ?? null,
    adultsMax: input.adultsMax ?? null,
    childrenMax: input.childrenMax,
    infantsAllowed: input.infantsAllowed,
    petsAllowed: input.petsAllowed,
    bedConfig: input.bedConfig,
    accessible: input.accessible,
    basePrice: input.basePrice,
    publicVisible: input.publicVisible,
    displayOrder: input.displayOrder,
    internalNotes: input.internalNotes ?? '',
    createdBy: user.id,
  })
  if (input.amenityIds.length > 0) await setRoomAmenities(id, input.amenityIds)

  await logAudit({
    actorId: user.id,
    action: 'accommodation.created',
    targetTable: 'rooms',
    targetId: id,
    metadata: { pousadaId, name: input.name },
  })
}

export async function editRoom(id: string, input: RoomInput): Promise<void> {
  const { pousadaId } = await requireCapability('room:manage')
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')
  await requireRoomInActivePousada(id, pousadaId)

  await updateRoom(id, {
    name: input.name,
    code: input.code || null,
    categoryId: input.categoryId || null,
    description: input.description ?? '',
    operationalDescription: input.operationalDescription ?? '',
    location: input.location ?? '',
    capacity: input.capacity,
    capacityMax: input.capacityMax ?? null,
    adultsMax: input.adultsMax ?? null,
    childrenMax: input.childrenMax,
    infantsAllowed: input.infantsAllowed,
    petsAllowed: input.petsAllowed,
    bedConfig: input.bedConfig,
    accessible: input.accessible,
    basePrice: input.basePrice,
    publicVisible: input.publicVisible,
    displayOrder: input.displayOrder,
    internalNotes: input.internalNotes ?? '',
    updatedBy: user.id,
  })
  await setRoomAmenities(id, input.amenityIds)

  await logAudit({
    actorId: user.id,
    action: 'accommodation.updated',
    targetTable: 'rooms',
    targetId: id,
    metadata: { pousadaId },
  })
}

/** Inativa/reativa CADASTRO — nunca exclui fisicamente (preserva histórico). */
export async function setRoomActive(id: string, active: boolean): Promise<void> {
  const { pousadaId } = await requireCapability('room:manage')
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')
  await requireRoomInActivePousada(id, pousadaId)

  await setRoomStatus(id, active ? 'active' : 'inactive', user.id)
  await logAudit({
    actorId: user.id,
    action: active ? 'accommodation.reactivated' : 'accommodation.inactivated',
    targetTable: 'rooms',
    targetId: id,
    metadata: { pousadaId },
  })
}

/** Status OPERACIONAL — via RPC, único caminho aberto também à Governança. */
export async function setOperationalStatus(
  id: string,
  status: ManagedRoom['operationalStatus'],
): Promise<void> {
  const { pousadaId } = await requireCapability('room:status:manage')
  // Sem pré-leitura de `rooms`: a Governança não tem leitura direta (rooms_read)
  // e a RPC já confere que a acomodação existe e é desta pousada.
  await updateRoomOperationalStatus(pousadaId, id, status)
  // Auditoria gravada atomicamente pela RPC — não duplicar aqui.
}
