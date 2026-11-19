import 'server-only'
import { requireCapability } from '@/lib/auth/require-capability'
import { can } from '@/lib/auth/rbac'
import { absoluteUrl } from '@/lib/seo'
import { sendEmail } from '@/lib/email/mailer'
import { contractAcceptedEmail } from '@/lib/email/contract-email'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import {
  acceptContractRpc,
  getAcceptedContractRpc,
  getContractStateRpc,
  listContractVersionsRpc,
  publishContractVersionRpc,
  saveContractDraftRpc,
} from '@/repositories/contracts.repository'
import type { SaveContractDraftInput } from '../schemas'
import type {
  AcceptedContract,
  ContractAcceptResult,
  ContractState,
  ContractVersionAdmin,
} from '../types'

/**
 * Contrato da pousada com a Rota (0103).
 *
 * Primeira barreira: `contract:view` (dono e gestor) e `contract:accept` (só o
 * proprietário) na pousada ATIVA. A segunda está nas RPCs
 * (`auth_can_manage_pousada` / `auth_is_active_owner_of`). O texto do contrato
 * é montado no banco e a prova do aceite fica lá, sem alteração possível.
 */

export const CONTRACT_PANEL_PATH = '/dashboard/configuracoes/contrato'

export async function getContractState(): Promise<ContractState> {
  const { pousadaId } = await requireCapability('contract:view')
  return getContractStateRpc(pousadaId)
}

/** Cópia guardada do contrato aceito (a mais recente); `null` se nunca aceitou. */
export async function getAcceptedContract(): Promise<AcceptedContract | null> {
  const { pousadaId } = await requireCapability('contract:view')
  return getAcceptedContractRpc(pousadaId)
}

/**
 * Aceita o contrato vigente. O IP e o navegador entram na prova só como
 * registro: quem decide se o aceite vale é o banco (papel, versão e hash).
 */
export async function acceptContract(
  input: { versionId: string; bodySha256: string },
  request: { ip: string; userAgent: string },
): Promise<ContractAcceptResult> {
  const { pousadaId } = await requireCapability('contract:accept')
  const result = await acceptContractRpc({
    pousadaId,
    versionId: input.versionId,
    bodySha256: input.bodySha256,
    ip: request.ip,
    userAgent: request.userAgent,
  })
  // Repetição do mesmo aceite não manda e-mail de novo.
  if (!result.already) await notifyContractAccepted(pousadaId)
  return result
}

/**
 * E-mail com o texto aceito para o proprietário e, se `CONTRACTS_NOTIFY_EMAIL`
 * estiver configurado, para a Rota. Falha no envio não desfaz o aceite: a
 * prova está no banco e o painel mostra o contrato.
 */
async function notifyContractAccepted(pousadaId: string): Promise<void> {
  try {
    const accepted = await getAcceptedContractRpc(pousadaId)
    if (!accepted) return
    const base = {
      pousadaName: accepted.pousadaName,
      acceptedByName: accepted.acceptedByName,
      acceptedByEmail: accepted.acceptedByEmail,
      versionTitle: accepted.versionTitle,
      versionCode: accepted.versionCode,
      acceptedAt: accepted.acceptedAt,
      sha256: accepted.sha256,
      body: accepted.body,
      panelUrl: absoluteUrl(CONTRACT_PANEL_PATH),
    }
    const sends: Promise<boolean>[] = []
    if (accepted.acceptedByEmail) {
      const email = contractAcceptedEmail({ ...base, recipient: 'owner' })
      sends.push(sendEmail({ to: accepted.acceptedByEmail, ...email }))
    }
    const rota = process.env.CONTRACTS_NOTIFY_EMAIL?.trim()
    if (rota) {
      const email = contractAcceptedEmail({ ...base, recipient: 'rota' })
      sends.push(sendEmail({ to: rota, ...email }))
    }
    await Promise.all(sends)
  } catch (error) {
    console.error('[contrato] falha ao enviar o e-mail do contrato aceito', error)
  }
}

/**
 * Para a configuração guiada: o passo "Contrato" só aparece com contrato
 * vigente. Erro de leitura não derruba o painel (o passo simplesmente some).
 */
export async function getContractSetupInfo(): Promise<{
  active: boolean
  accepted: boolean
} | null> {
  try {
    const state = await getContractState()
    return { active: state.active, accepted: state.acceptedCurrent }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Admin (master): versões do contrato
// ---------------------------------------------------------------------------

async function requireMaster() {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'platform:configure')) {
    throw new Error('Só o master pode gerenciar o contrato das pousadas.')
  }
  return user
}

export async function listContractVersions(): Promise<ContractVersionAdmin[]> {
  await requireMaster()
  return listContractVersionsRpc()
}

export async function saveContractDraft(input: SaveContractDraftInput): Promise<{ id: string }> {
  await requireMaster()
  return { id: await saveContractDraftRpc(input) }
}

export async function publishContractVersion(code: string): Promise<{ id: string }> {
  await requireMaster()
  return { id: await publishContractVersionRpc(code) }
}
