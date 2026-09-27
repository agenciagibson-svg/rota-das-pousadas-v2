import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Enums } from '@/lib/supabase/database.types'
import type {
  AdminPousadaRow,
  AuditLogEntry,
  LoginAttemptRow,
  PendingPousada,
  PlatformHost,
  PlatformTeamMember,
  PlatformRoleValue,
} from '@/features/admin/types'

export type PousadaStatus = Enums<'pousada_status'>

/** Pousadas em análise (RLS: leitura permitida a platform admin). */
export async function listPendingPousadas(): Promise<PendingPousada[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousadas')
    .select('id, slug, name, city, state, created_at')
    .eq('status', 'em_analise')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    city: r.city,
    state: r.state,
    createdAt: r.created_at,
  }))
}

/** Resolve o slug para revalidar a página pública após mudança de status. */
export async function getPousadaSlugById(id: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('pousadas').select('slug').eq('id', id).maybeSingle()
  if (error) throw error
  return data?.slug ?? null
}

/** Nome + slug — cabeçalho da tela de acessos institucionais de uma pousada. */
export async function getPousadaHeaderById(
  id: string,
): Promise<{ name: string; slug: string } | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousadas')
    .select('name, slug')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? { name: data.name, slug: data.slug } : null
}

/** Atualiza o status de uma pousada (RLS: apenas platform admin pode). */
export async function setPousadaStatus(id: string, status: PousadaStatus): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('pousadas').update({ status }).eq('id', id)
  if (error) throw error
}

/**
 * Todas as pousadas da plataforma, qualquer status (RLS já libera leitura
 * plataforma-wide via `auth_is_platform_admin()`). Nome do proprietário vem
 * de uma segunda consulta + join em memória — mesmo padrão de
 * `listBookingsByGuest` (repositories/bookings.repository.ts), já que o
 * client do Supabase não faz join arbitrário entre memberships/profiles e
 * pousadas numa única chamada.
 */
export async function listAllPousadasForAdmin(filter?: PousadaStatus): Promise<AdminPousadaRow[]> {
  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('pousadas')
    .select('id, slug, name, city, state, status, image, created_at')
    .order('created_at', { ascending: false })
  if (filter) query = query.eq('status', filter)

  const { data: rows, error } = await query
  if (error) throw error
  if (!rows || rows.length === 0) return []

  // Dono vem da RPC `list_platform_hosts` (0040, security definer). Antes era
  // um join memberships→profiles direto, mas a RLS de `profiles` só deixa cada
  // um ler o próprio perfil — o nome sempre voltava vazio e a tela dizia
  // "Sem proprietário vinculado" mesmo com dono ativo.
  const owners = await listPlatformHosts().catch((error: unknown) => {
    console.error('[admin] falha ao listar proprietários', error)
    return [] as PlatformHost[]
  })
  const ownerByPousada = new Map<string, { name: string; email: string }>()
  for (const o of owners) {
    if (!ownerByPousada.has(o.pousadaId)) {
      ownerByPousada.set(o.pousadaId, { name: o.fullName?.trim() || o.email, email: o.email })
    }
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    city: r.city,
    state: r.state,
    status: r.status,
    image: r.image,
    ownerName: ownerByPousada.get(r.id)?.name ?? null,
    ownerEmail: ownerByPousada.get(r.id)?.email ?? null,
    createdAt: r.created_at,
  }))
}

/** Vincula um e-mail ja cadastrado como proprietario ativo (RPC `link_pousada_owner`, 0052). */
export async function linkPousadaOwnerRpc(pousadaId: string, email: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('link_pousada_owner', {
    p_pousada_id: pousadaId,
    p_email: email,
  })
  if (error) throw new Error(error.message)
}

type PlatformHostRow = {
  user_id: string
  full_name: string
  email: string
  pousada_id: string
  pousada_name: string
  pousada_slug: string
  created_at: string
}

/** Anfitriões (proprietários) ativos em toda a plataforma — RPC 0040 (e-mail vem de auth.users). */
export async function listPlatformHosts(): Promise<PlatformHost[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_platform_hosts')
  if (error) throw error
  const rows = (data ?? []) as PlatformHostRow[]
  return rows.map((r) => ({
    userId: r.user_id,
    fullName: r.full_name,
    email: r.email,
    pousadaId: r.pousada_id,
    pousadaName: r.pousada_name,
    pousadaSlug: r.pousada_slug,
    createdAt: r.created_at,
  }))
}

type PlatformTeamRow = {
  user_id: string
  full_name: string
  email: string
  platform_role: PlatformRoleValue
  created_at: string
}

/** Equipe atual de plataforma (RPC `list_platform_team`, 0054 — só master enxerga). */
export async function listPlatformTeam(): Promise<PlatformTeamMember[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_platform_team')
  if (error) throw error
  const rows = (data ?? []) as PlatformTeamRow[]
  return rows.map((r) => ({
    userId: r.user_id,
    fullName: r.full_name,
    email: r.email,
    platformRole: r.platform_role,
    createdAt: r.created_at,
  }))
}

/** Atribui/troca o papel de plataforma de um e-mail já cadastrado (RPC `set_platform_role_by_email`, 0054). */
export async function setPlatformRoleByEmail(
  email: string,
  role: PlatformRoleValue,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('set_platform_role_by_email', {
    p_email: email,
    p_role: role,
  })
  if (error) throw new Error(error.message)
}

/** Remove o papel de plataforma de um e-mail (RPC `revoke_platform_role_by_email`, 0054). */
export async function revokePlatformRoleByEmail(email: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('revoke_platform_role_by_email', { p_email: email })
  if (error) throw new Error(error.message)
}

export type AuditLogFilter = {
  /** Busca parcial (ilike) em `action`, ex.: "member", "pousada.status". */
  action?: string
  from?: string
  to?: string
  limit?: number
}

/**
 * Trilha de auditoria plataforma inteira. RLS `audit_read` (0053) restringe
 * a leitura direta desta tabela a `master` — de propósito, ver rota-seguranca
 * no histórico do projeto. Nome do ator vem de join em `profiles` (só
 * `full_name`; e-mail vive em `auth.users` e não é acessível por join direto
 * do client, mesmo padrão de `listAllPousadasForAdmin`). `actor_id` pode ser
 * `null` (eventos disparados por cron, ex. expiração de reserva).
 */
export async function listAuditLog(filter: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('audit_log')
    .select('id, action, target_table, target_id, metadata, created_at, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 200)
  if (filter.action) query = query.ilike('action', `%${filter.action}%`)
  if (filter.from) query = query.gte('created_at', filter.from)
  if (filter.to) query = query.lte('created_at', filter.to)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    actorName: r.profiles?.[0]?.full_name ?? null,
    action: r.action,
    targetTable: r.target_table,
    targetId: r.target_id,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }))
}

export type LoginAttemptFilter = {
  /** Busca parcial (ilike) em `email`, aplicada dentro da própria RPC. */
  email?: string
  limit?: number
}

/**
 * Relatório de login (tentativas recentes) — `login_attempts` (0053) não
 * tem NENHUMA policy de leitura direta de propósito (só as RPCs de rate
 * limiting), então a única forma de ler é a RPC dedicada `list_login_attempts`
 * (0057), que já devolve o IP mascarado e só funciona para `master`
 * (`auth_is_platform_master` dentro da função — segunda camada de defesa
 * além do `can()` no service). A tabela se autolimpa sozinha (~1 dia), então
 * isto é sempre uma janela recente, não um histórico longo.
 */
export async function listLoginAttempts(
  filter: LoginAttemptFilter = {},
): Promise<LoginAttemptRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_login_attempts', {
    p_email: filter.email?.trim() || null,
    p_limit: filter.limit ?? 200,
  })
  if (error) throw error
  const rows = (data ?? []) as {
    id: string
    email: string
    ip_masked: string | null
    success: boolean
    created_at: string
  }[]
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    ipMasked: r.ip_masked,
    success: r.success,
    createdAt: r.created_at,
  }))
}
