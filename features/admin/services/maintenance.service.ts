import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { can } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/log'
import { sendMonthlyReportPreview } from '@/features/dashboard/services/monthly-report.service'
import { backfillGuestProfilesFromTravelers } from '@/features/hospedes/services/guest-profile-backfill.service'

/**
 * Rotinas de manutenção do /admin → Configurações (0097), só master
 * (`platform:configure`, a mesma porta do "Enviar e-mail de teste"). A
 * checagem é feita AQUI, antes de qualquer chamada às RPCs de service_role.
 */
async function requireMaster() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'platform:configure')) {
    throw new Error('Só o master pode usar esta ferramenta.')
  }
  return user
}

/** Relatório do mês de uma pousada, só para o e-mail de quem clicou. Não marca enviado. */
export async function previewMonthlyReportAdmin(pousadaId: string) {
  const user = await requireMaster()
  if (!user.email) throw new Error('Sua conta não tem e-mail para receber a prévia.')
  const result = await sendMonthlyReportPreview(pousadaId, user.email)
  await logAudit({
    actorId: user.id,
    action: 'admin.monthly_report.preview',
    targetTable: 'pousadas',
    targetId: pousadaId,
    metadata: { month: result.month, status: result.status },
  })
  return result
}

/** Completa as fichas antigas de hóspede pelo perfil do viajante. */
export async function backfillGuestProfilesAdmin() {
  const user = await requireMaster()
  const result = await backfillGuestProfilesFromTravelers()
  await logAudit({
    actorId: user.id,
    action: 'admin.guests.profile_backfill',
    metadata: { ...result },
  })
  return result
}
