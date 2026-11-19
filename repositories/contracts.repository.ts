import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  AcceptedContract,
  ContractAcceptResult,
  ContractAcceptanceSummary,
  ContractState,
  ContractVersionAdmin,
} from '@/features/contrato/types'

/**
 * Contrato da pousada (0103). Tudo por RPC: as tabelas não têm acesso pela
 * API, o texto é montado no banco e a prova do aceite não se altera.
 */

type Raw = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

function summary(v: unknown): ContractAcceptanceSummary | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Raw
  return {
    acceptedAt: str(r.acceptedAt),
    acceptedByName: str(r.acceptedByName),
    versionCode: str(r.versionCode),
    versionTitle: str(r.versionTitle),
    sha256: str(r.sha256),
  }
}

export async function getContractStateRpc(pousadaId: string): Promise<ContractState> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_pousada_contract_state', {
    p_pousada_id: pousadaId,
  })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as Raw
  const version = r.version && typeof r.version === 'object' ? (r.version as Raw) : null
  return {
    active: r.active === true,
    version: version
      ? {
          id: str(version.id),
          code: str(version.code),
          title: str(version.title),
          publishedAt: strOrNull(version.publishedAt),
          requiresReaccept: version.requiresReaccept !== false,
        }
      : null,
    canAccept: r.canAccept === true,
    acceptedCurrent: r.acceptedCurrent === true,
    latestAcceptance: summary(r.latestAcceptance),
    body: strOrNull(r.body),
    bodySha256: strOrNull(r.bodySha256),
    missing: Array.isArray(r.missing)
      ? r.missing.filter((m): m is string => typeof m === 'string')
      : [],
    firstPublishedAt: strOrNull(r.firstPublishedAt),
    founderRank: typeof r.founderRank === 'number' ? r.founderRank : null,
    commissionExemptUntil: strOrNull(r.commissionExemptUntil),
    commissionRateLockedUntil: strOrNull(r.commissionRateLockedUntil),
  }
}

export async function acceptContractRpc(input: {
  pousadaId: string
  versionId: string
  bodySha256: string
  ip: string
  userAgent: string
}): Promise<ContractAcceptResult> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('accept_pousada_contract', {
    p_pousada_id: input.pousadaId,
    p_version_id: input.versionId,
    p_body_sha256: input.bodySha256,
    p_ip: input.ip,
    p_user_agent: input.userAgent,
  })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as Raw
  return {
    acceptedAt: str(r.acceptedAt),
    versionCode: str(r.versionCode),
    already: r.already === true,
  }
}

export async function getAcceptedContractRpc(pousadaId: string): Promise<AcceptedContract | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_pousada_contract_acceptance', {
    p_pousada_id: pousadaId,
  })
  if (error) throw new Error(error.message)
  const base = summary(data)
  if (!base) return null
  const r = data as Raw
  return {
    ...base,
    acceptedByEmail: str(r.acceptedByEmail),
    body: str(r.body),
    pousadaName: str(r.pousadaName),
  }
}

export async function listContractVersionsRpc(): Promise<ContractVersionAdmin[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_contract_versions')
  if (error) throw new Error(error.message)
  return (Array.isArray(data) ? (data as Raw[]) : []).map((r) => ({
    id: str(r.id),
    code: str(r.code),
    title: str(r.title),
    bodyTemplate: str(r.bodyTemplate),
    requiresReaccept: r.requiresReaccept !== false,
    publishedAt: strOrNull(r.publishedAt),
    updatedAt: str(r.updatedAt),
    current: r.current === true,
    acceptances: Number(r.acceptances ?? 0),
  }))
}

export async function saveContractDraftRpc(input: {
  code: string
  title: string
  bodyTemplate: string
  requiresReaccept: boolean
}): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('save_contract_version_draft', {
    p_code: input.code,
    p_title: input.title,
    p_body_template: input.bodyTemplate,
    p_requires_reaccept: input.requiresReaccept,
  })
  if (error) throw new Error(error.message)
  return String(data)
}

export async function publishContractVersionRpc(code: string): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('publish_contract_version', { p_code: code })
  if (error) throw new Error(error.message)
  return String(data)
}
