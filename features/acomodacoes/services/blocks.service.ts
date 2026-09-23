import 'server-only'
import { requireCapability } from './access'
import { civilDateTimeToISO } from '@/lib/dates'
import {
  listBlocksByPousada,
  createRoomBlock,
  cancelRoomBlock,
} from '@/repositories/room-blocks.repository'
import type { RoomBlock } from '@/features/acomodacoes/types'
import type { CreateBlockInput } from '@/features/acomodacoes/schemas'

/** Auditoria de criação/cancelamento é gravada atomicamente pelas RPCs — não duplicar aqui. */

export async function listBlocks(): Promise<RoomBlock[]> {
  const { pousadaId } = await requireCapability('room:block:view')
  return listBlocksByPousada(pousadaId)
}

export async function addBlock(input: CreateBlockInput): Promise<void> {
  const { pousadaId } = await requireCapability('room:block:manage')
  await createRoomBlock({
    pousadaId,
    roomId: input.roomId,
    blockType: input.blockType,
    startsAt: civilDateTimeToISO(input.startsAt),
    endsAt: civilDateTimeToISO(input.endsAt),
    reason: input.reason,
    notes: input.notes ?? '',
  })
}

export async function cancelBlock(id: string, cancellationReason: string): Promise<void> {
  const { pousadaId } = await requireCapability('room:block:manage')
  await cancelRoomBlock(pousadaId, id, cancellationReason)
}
