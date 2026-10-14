import 'server-only'

/** Primeira barreira (RBAC de app) para as telas de acomodações — a RLS/RPC no banco é a segunda. */
export { requireCapability } from '@/lib/auth/require-capability'
