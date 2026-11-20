import 'server-only'
import { can } from '@/lib/auth/rbac'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { publicEnv } from '@/lib/env'
import { sendEmailWithResult, maskRecipient } from '@/lib/email/mailer'
import { welcomeGuideEmail } from '@/lib/email/welcome-guide-email'
import { reportError } from '@/lib/observability/report-error'
import { marketingLinks } from '@/features/origem/origin'
import { guideWhatsappText, whatsappNumber } from '@/features/origem/guide'
import { listPlatformHosts } from '@/repositories/admin.repository'
import {
  getPousadaForGuide,
  getWelcomeGuideAuto,
  hasWelcomeGuideEmail,
  insertWelcomeGuideSend,
  lastWelcomeGuideSends,
  setWelcomeGuideAuto,
  type WelcomeGuideSend,
} from '@/repositories/welcome-guide.repository'

/**
 * Guia de boas-vindas (0107): quando a pousada é publicada, o proprietário
 * recebe por e-mail os 3 links com a origem marcada e o passo a passo. O master
 * liga/desliga o envio automático; comercial e master mandam na mão (e-mail ou
 * WhatsApp aberto já com o texto).
 */

async function assertCanSend() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'pousada:approve')) {
    throw new Error('Você não tem permissão para enviar o guia.')
  }
  return user
}

async function assertMaster() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'platform:configure')) {
    throw new Error('Só o master muda o envio automático.')
  }
  return user
}

function domainOf(email: string): string | null {
  const at = email.lastIndexOf('@')
  return at > 0 ? email.slice(at + 1).toLowerCase() : null
}

async function ownerOf(pousadaId: string) {
  const hosts = await listPlatformHosts()
  const host = hosts.find((h) => h.pousadaId === pousadaId)
  return host ? { name: host.fullName?.trim() || null, email: host.email } : null
}

export type WelcomeGuideResult =
  | { status: 'enviado'; to: string }
  | { status: 'sem-dono' }
  | { status: 'nao-publicada' }
  | { status: 'sem-config' }
  | { status: 'falhou' }

async function sendEmailGuide(
  pousadaId: string,
  trigger: 'auto' | 'manual',
  userId: string,
): Promise<WelcomeGuideResult> {
  const pousada = await getPousadaForGuide(pousadaId)
  if (!pousada || pousada.status !== 'publicada') return { status: 'nao-publicada' }
  const owner = await ownerOf(pousadaId)
  if (!owner?.email) return { status: 'sem-dono' }

  const site = publicEnv.siteUrl
  const email = welcomeGuideEmail({
    pousadaName: pousada.name,
    ownerName: owner.name,
    links: marketingLinks(site, pousada.slug),
    panelUrl: `${site}/dashboard/link`,
    pageUrl: `${site}/pousada/${pousada.slug}`,
  })
  const result = await sendEmailWithResult({ to: owner.email, ...email })
  if (result.status === 'sem-config') return { status: 'sem-config' }
  if (result.status !== 'enviado') return { status: 'falhou' }

  await insertWelcomeGuideSend({
    pousadaId,
    channel: 'email',
    trigger,
    recipientDomain: domainOf(owner.email),
    sentBy: userId,
  })
  return { status: 'enviado', to: maskRecipient(owner.email) }
}

/** Botão "Enviar guia por e-mail" do /admin → Pousadas. */
export async function sendWelcomeGuideEmailAdmin(pousadaId: string): Promise<WelcomeGuideResult> {
  const user = await assertCanSend()
  return sendEmailGuide(pousadaId, 'manual', user.id)
}

/**
 * Chamado logo depois de publicar a pousada (aprovação, mudança de status ou
 * vínculo do dono). Só envia com o automático ligado e se a pousada ainda não
 * recebeu o guia por e-mail. Nunca lança: publicar não pode falhar por causa
 * do e-mail.
 */
export async function sendWelcomeGuideIfAuto(pousadaId: string): Promise<void> {
  try {
    const user = await getCurrentUser()
    if (!user) return
    if (!(await getWelcomeGuideAuto())) return
    if (await hasWelcomeGuideEmail(pousadaId)) return
    await sendEmailGuide(pousadaId, 'auto', user.id)
  } catch (error) {
    reportError(error, { where: 'welcome-guide.auto' })
  }
}

/**
 * Link do WhatsApp já com o texto do guia, para o número da pousada. Registra
 * o envio ao abrir (o admin ainda confirma o envio no próprio WhatsApp).
 */
export async function welcomeGuideWhatsappAdmin(
  pousadaId: string,
): Promise<{ url: string } | { error: string }> {
  const user = await assertCanSend()
  const pousada = await getPousadaForGuide(pousadaId)
  if (!pousada) return { error: 'Pousada não encontrada.' }
  if (pousada.status !== 'publicada') {
    return { error: 'Publique a pousada antes: os links levam para a página pública dela.' }
  }
  const number = whatsappNumber(pousada.whatsapp)
  if (!number) return { error: 'A pousada não tem WhatsApp cadastrado.' }
  const site = publicEnv.siteUrl
  const text = guideWhatsappText({
    pousadaName: pousada.name,
    links: marketingLinks(site, pousada.slug),
    panelUrl: `${site}/dashboard/link`,
  })
  await insertWelcomeGuideSend({
    pousadaId,
    channel: 'whatsapp',
    trigger: 'manual',
    recipientDomain: null,
    sentBy: user.id,
  })
  return { url: `https://wa.me/${number}?text=${encodeURIComponent(text)}` }
}

export async function getWelcomeGuideAutoAdmin(): Promise<boolean> {
  await assertCanSend()
  return getWelcomeGuideAuto()
}

export async function setWelcomeGuideAutoAdmin(enabled: boolean): Promise<void> {
  const user = await assertMaster()
  await setWelcomeGuideAuto(enabled, user.id)
}

export async function listLastWelcomeGuideSends(): Promise<Record<string, WelcomeGuideSend>> {
  await assertCanSend()
  return Object.fromEntries(await lastWelcomeGuideSends())
}
