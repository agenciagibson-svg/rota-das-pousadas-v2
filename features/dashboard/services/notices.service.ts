import 'server-only'
import { getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import type { listOwnerReservations, getOwnerPousada } from '@/features/gestao/services/pms.service'
import type { getPaymentAlerts } from '@/features/pagamentos/services/pix.service'
import type { getOperationalAlerts } from '@/features/pedidos/services/orders.service'
import type { listChannels } from '@/features/canais/services/channels.service'
import type { getSetupProgress } from '@/features/onboarding/services/setup.service'
import { reportError } from '@/lib/observability/report-error'
import { addDays, dayMovements, pousadaToday } from '../metrics'
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
 * Fontes do sino. Vêm de `server/queries` já com `cache()` do React: a tela
 * inicial do painel pede as mesmas listas, e no mesmo request cada consulta
 * roda uma vez só (o layout e a página dividem o resultado).
 */
export type NoticeSources = {
  pousada: typeof getOwnerPousada
  reservations: () => ReturnType<typeof listOwnerReservations>
  payments: typeof getPaymentAlerts
  operational: typeof getOperationalAlerts
  channels: typeof listChannels
  setup: typeof getSetupProgress
}

/**
 * Avisos do sino do painel da pousada ativa, respeitando o papel de quem vê
 * (cada fonte já confere a própria permissão; aqui só não pedimos o que o papel
 * não usa, para não gastar consulta à toa).
 */
export async function getDashboardNotices(src: NoticeSources): Promise<Notice[]> {
  const [role, pousada] = await Promise.all([getActiveTenantRole(), src.pousada()])
  if (!role || !pousada) return []

  const seesBookings = can(role, 'booking:manage')
  const [reservations, payments, operational, channels, setup] = await Promise.all([
    seesBookings ? safe('reservas', () => src.reservations()) : null,
    safe('pagamentos', () => src.payments()),
    safe('operacao', () => src.operational()),
    can(role, 'channel:view') ? safe('canais', () => src.channels()) : null,
    can(role, 'pousada:edit') ? safe('configuracao', () => src.setup()) : null,
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
    // Confirmadas que chegam hoje ou nos próximos 3 dias e ainda sem ficha (0088).
    arrivalsWithoutPrecheckin: reservations
      ? reservations.filter(
          (r) =>
            r.status === 'confirmed' &&
            !r.precheckinDone &&
            r.checkin >= today &&
            r.checkin <= addDays(today, 3),
        ).length
      : null,
    newOrders: operational ? operational.newOrders : null,
    lowStock: operational ? operational.lowStock.length : null,
    channelErrors: channels
      ? channels.filter((c) => c.importEnabled && c.lastSyncStatus === 'error').length
      : null,
    setupMissing: setup && !setup.complete ? setup.missingRequired : null,
  })
}
