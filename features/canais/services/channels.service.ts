import 'server-only'
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { requireCapability } from './access'
import {
  deleteChannelRpc,
  listChannelsByPousada,
  saveChannelRpc,
} from '@/repositories/channels.repository'
import type { ChannelIdInput, SaveChannelInput } from '../schemas'
import type { ChannelCalendar } from '../types'

/**
 * Token do feed que a Rota publica.
 *
 * 32 bytes aleatórios em base64url. Não é identificador: é a única coisa que
 * separa o calendário de um quarto de qualquer pessoa na internet, já que o
 * feed é lido sem sessão. Gerado aqui, na aplicação, e não no banco, porque
 * `gen_random_bytes` exigiria a extensão pgcrypto (ver 0044).
 */
function newExportToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function listChannels(): Promise<ChannelCalendar[]> {
  const { pousadaId } = await requireCapability('channel:view')
  return listChannelsByPousada(pousadaId)
}

/**
 * Cria ou atualiza o canal de um quarto.
 *
 * O token NÃO é regerado na atualização: a URL já está colada na extranet da
 * OTA, e trocá-la em silêncio quebraria o feed sem ninguém perceber. A RPC da
 * 0044 também protege isso no `on conflict`, mas o token novo gerado aqui é
 * simplesmente ignorado quando o canal já existe.
 */
export async function saveChannel(input: SaveChannelInput): Promise<{ id: string }> {
  await requireCapability('channel:manage')
  const id = await saveChannelRpc({
    roomId: input.roomId,
    provider: input.provider,
    label: input.label,
    importUrl: input.importUrl === '' ? null : input.importUrl,
    exportToken: newExportToken(),
  })
  revalidatePath('/dashboard/acomodacoes/canais')
  return { id }
}

export async function removeChannel(input: ChannelIdInput): Promise<{ removed: true }> {
  await requireCapability('channel:manage')
  await deleteChannelRpc(input.calendarId)
  revalidatePath('/dashboard/acomodacoes/canais')
  return { removed: true }
}
