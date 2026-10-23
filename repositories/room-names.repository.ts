import 'server-only'
import type { createSupabaseServerClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>

/**
 * Nome dos quartos para a equipe da pousada.
 *
 * Quem lê `rooms` (proprietário, gestor, recepção) recebe direto. Quem não lê
 * (financeiro) recebe pela função `pousada_room_names` (0093), que abre só id e
 * nome. Se a função ainda não existir no banco, o nome fica de fora e a tela
 * mostra "Acomodação", como antes.
 */
export async function roomNamesById(
  supabase: Client,
  pousadaId: string,
  roomIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(roomIds.filter(Boolean))]
  const names = new Map<string, string>()
  if (ids.length === 0) return names

  const { data: rooms } = await supabase.from('rooms').select('id, name').in('id', ids)
  for (const room of rooms ?? []) names.set(room.id, room.name)
  if (ids.every((id) => names.has(id))) return names

  const { data: fallback } = await supabase.rpc('pousada_room_names', { p_pousada: pousadaId })
  for (const room of fallback ?? []) if (!names.has(room.id)) names.set(room.id, room.name)
  return names
}
