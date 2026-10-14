import 'server-only'

/**
 * Primeira barreira (RBAC de app) para as telas de canais — a RLS e as RPCs da
 * 0044 são a segunda. As duas precisam concordar: `channel:manage` só existe
 * para proprietário e admin da pousada, exatamente como `auth_can_manage_channels`
 * no banco. Recepção vê (`channel:view`) mas não configura.
 */
export { requireCapability } from '@/lib/auth/require-capability'
