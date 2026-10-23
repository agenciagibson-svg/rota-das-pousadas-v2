import 'server-only'
import { getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import { listOwnerReservations, getOwnerPousada } from '@/features/gestao/services/pms.service'
import { getPaymentAlerts } from '@/features/pagamentos/services/pix.service'
import { getOperationalAlerts } from '@/features/pedidos/services/orders.service'
import { listChannels } from '@/features/canais/services/channels.service'
import { getSetupProgress } from '@/features/onboarding/services/setup.service'
import { reportError } from '@/lib/observability/report-error'
import { dayMovements, pousadaToday } from '../metrics'
import { buildNotices, type Notice } from '../notices'

/** Falha numa fonte nunca derruba o sino: o aviso dela só não aparece. */
async function safe<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch (error) {
    await reportError(error, { where: `notices:${label}` })
    return null
  }
}

/**
 * Avisos do sino do painel da pousada ativa, respeitando o papel de quem vê
 * (cada fonte já confere a própria permissão; aqui só não pedimos o que o papel
 * não usa, para não gastar consulta à toa).
 */
export async function getDashboardNotices(): Promise<Notice[]> {
  const [role, pousada] = await Promise.all([getActiveTenantRole(), getOwnerPousada()])
  if (!role || !pousada) return []

  const seesBookings = can(role, 'booking:manage')
  const [reservations, payments, operational, channels, setup] = await Promise.all([
    seesBookings ? safe('reservas', () => listOwnerReservations()) : null,
    safe('pagamentos', () => getPaymentAlerts()),
    safe('operacao', () => getOperationalAlerts()),
    can(role, 'channel:view') ? safe('canais', () => listChannels()) : null,
    can(role, 'pousada:edit') ? safe('configuracao', () => getSetupProgress()) : null,
  ])

  const today = pousadaToday(new Date(), pousada.timezone).iso
  const arrivals = reservations ? dayMovements(reservations, today).arrivals : null

  return buildNotices({
    proofsToReview: payments ? payments.openProofs.length : null,
    paymentReviews: payments ? payments.reviews.length : null,
    pendingBookings: reservations
      ? reservations.filter((r) => r.status === 'pending' && !r.proofPending).length
      : null,
    arrivalsToday: arrivals ? arrivals.filter((r) => r.status !== 'checked_in').length : null,
    arrivalsWithoutPrecheckin: null,
    newOrders: operational ? operational.newOrders : null,
    lowStock: operational ? operational.lowStock.length : null,
    channelErrors: channels
      ? channels.filter((c) => c.importEnabled && c.lastSyncStatus === 'error').length
      : null,
    setupMissing: setup && !setup.complete ? setup.missingRequired : null,
  })
}
