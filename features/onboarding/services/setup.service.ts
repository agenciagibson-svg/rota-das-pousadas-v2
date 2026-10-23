import 'server-only'
import { getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import { getOwnerSettings } from '@/features/gestao/services/pms.service'
import { getOwnerRooms } from '@/features/acomodacoes/services/rooms.service'
import { getOwnerPixSettings } from '@/features/pagamentos/services/pix.service'
import { getOwnerSubscriptionStatus } from '@/features/pagamentos/services/subscription.service'
import { getOwnerPaymentAccountStatus } from '@/features/pagamentos/services/oauth.service'
import { listChannels } from '@/features/canais/services/channels.service'
import { listTeam } from '@/features/membros/services/team.service'
import { buildSetupSteps, summarizeSetup, type SetupProgress } from '../setup'

/** Leitura que falhou conta como "não feito" — o passo continua visível, nunca some por erro. */
async function orNull<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch {
    return null
  }
}

/**
 * Configuração guiada da pousada ativa. Só para quem configura a pousada
 * (`pousada:edit`: proprietário e gestor); para os outros papéis, `null`.
 */
export async function getSetupProgress(): Promise<SetupProgress | null> {
  const role = await getActiveTenantRole()
  if (!role || !can(role, 'pousada:edit')) return null

  const [settings, rooms, pix, subscription, card, channels, team] = await Promise.all([
    getOwnerSettings(),
    orNull(() => getOwnerRooms()),
    orNull(() => getOwnerPixSettings()),
    orNull(() => getOwnerSubscriptionStatus()),
    orNull(() => getOwnerPaymentAccountStatus()),
    orNull(() => listChannels()),
    orNull(() => listTeam()),
  ])
  if (!settings) return null

  const activeRooms = (rooms ?? []).filter((r) => r.status === 'active')
  return summarizeSetup(
    buildSetupSteps({
      gallery: settings.gallery,
      image: settings.image,
      description: settings.description,
      checkinTime: settings.checkinTime,
      checkoutTime: settings.checkoutTime,
      cancellationPolicy: settings.cancellationPolicy,
      whatsapp: settings.whatsapp,
      notificationEmail: settings.notificationEmail,
      sellableRooms: activeRooms.filter((r) => (r.basePrice ?? 0) > 0).length,
      roomsWithoutPhotos: activeRooms.filter((r) => r.gallery.length === 0).length,
      pixEnabled: Boolean(pix?.settings?.enabled && pix.settings.pixKey),
      subscriptionActive: subscription?.status === 'authorized',
      cardConnected: Boolean(card?.connected),
      channels: channels?.length ?? 0,
      teamMembers: (team ?? []).filter((m) => m.status === 'active').length,
    }),
  )
}
