import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Enums } from '@/lib/supabase/database.types'
import type {
  AdminPousadaRow,
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

  const pousadaIds = rows.map((r) => r.id)
  const { data: owners } = await supabase
    .from('memberships')
    .select('pousada_id, user_id, profiles(full_name)')
    .eq('role', 'proprietario')
    .in('pousada_id', pousadaIds)
  const ownerByPousada = new Map(
    (owners ?? []).map((o) => [o.pousada_id, o.profiles[0]?.full_name ?? null]),
  )

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    city: r.city,
    state: r.state,
    status: r.status,
    image: r.image,
    ownerName: ownerByPousada.get(r.id) ?? null,
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
