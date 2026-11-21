import 'server-only'
import { closeOverdueStaysAsService } from '@/repositories/bookings.repository'

/**
 * Rodada diária: fecha as estadias que a pousada esqueceu de fechar (0109).
 * Roda antes do pedido de avaliação, para quem saiu entrar na mesma rodada.
 */
export async function closeOverdueStaysDaily(): Promise<{ closed: number }> {
  return { closed: await closeOverdueStaysAsService() }
}
