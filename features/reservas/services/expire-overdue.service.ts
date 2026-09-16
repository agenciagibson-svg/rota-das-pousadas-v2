import 'server-only'
import { expireOverduePendingBookingsRpc } from '@/repositories/bookings.repository'

/**
 * Rodada de expiração automática de pré-reservas vencidas (0050, cron).
 * Sem tenant e sem sessão — varre todas as pousadas de uma vez via RPC
 * `service_role`. Camada de serviço fina de propósito: a decisão inteira
 * (quem expira, o que auditar) vive na RPC, não aqui — mesmo padrão de
 * `features/canais/services/sync.service.ts`, cuja lógica real é no loop de
 * feeds; aqui não há loop, só a chamada.
 */
export async function expireOverduePendingBookings(): Promise<{ expired: number }> {
  return expireOverduePendingBookingsRpc()
}
