import 'server-only'
import { headers } from 'next/headers'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { logAudit } from '@/lib/audit/log'
import { can } from '@/lib/auth/rbac'
import { verifyTurnstileToken } from '@/lib/turnstile'
import {
  listApprovedTips,
  listTipsForReview,
  moderateTip,
  submitTip,
} from '@/repositories/blog-tips.repository'
import { findPost } from '../posts'
import type { TipInput } from '../schemas'
import type { BlogTip, BlogTipForReview } from '../types'

/** Dicas aprovadas do guia. Falha no banco não derruba o guia: some o bloco. */
export async function tipsForPost(postSlug: string): Promise<BlogTip[]> {
  try {
    return await listApprovedTips(postSlug)
  } catch {
    return []
  }
}

/**
 * Envio público (sem sessão). Defesas: Turnstile aqui; validação, teto por
 * guia e teto da fila na RPC; upload da foto só no caminho que a RPC reservou.
 */
export async function submitBlogTip(input: TipInput): Promise<{ photoSaved: boolean }> {
  if (!findPost(input.postSlug)) throw new Error('Guia não encontrado.')
  const h = await headers()
  const remoteIp = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
  if (!(await verifyTurnstileToken(input.turnstileToken, remoteIp))) {
    throw new Error(
      'Não foi possível confirmar que você não é um robô. Atualize a página e tente de novo.',
    )
  }
  const result = await submitTip(input)
  return { photoSaved: result.photoSaved }
}

async function assertCanModerate() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'content:moderate')) {
    throw new Error('Você não tem permissão para moderar as dicas do blog.')
  }
  return user
}

export async function canModerateTips(): Promise<boolean> {
  const user = await getCurrentUser()
  return Boolean(user?.platformRole && can(user.platformRole, 'content:moderate'))
}

export async function listTipsAdmin(): Promise<BlogTipForReview[]> {
  await assertCanModerate()
  return listTipsForReview()
}

export async function moderateTipAdmin(id: string, status: 'aprovada' | 'recusada'): Promise<void> {
  const user = await assertCanModerate()
  await moderateTip(id, status)
  await logAudit({
    actorId: user.id,
    action: status === 'aprovada' ? 'blog_tip.approve' : 'blog_tip.reject',
    targetTable: 'blog_tips',
    targetId: id,
  })
}
