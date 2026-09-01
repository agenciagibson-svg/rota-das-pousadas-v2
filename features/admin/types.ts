/** Pousada aguardando aprovação da curadoria. */
export type PendingPousada = {
  id: string
  slug: string
  name: string
  city: string
  state: string
  createdAt: string
}

/**
 * Concessão de acesso institucional temporário da plataforma a dados
 * sensíveis (reservas/pagamentos/despesas) de uma pousada específica.
 * Ver supabase/migrations/0013_platform_access_grants.sql.
 */
export type PlatformAccessGrant = {
  id: string
  pousadaId: string
  grantedTo: string
  grantedBy: string | null
  reason: string
  grantedAt: string
  expiresAt: string
}
