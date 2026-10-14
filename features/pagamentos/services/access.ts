import 'server-only'

/** Primeira barreira (RBAC de app) para pagamentos — a RLS/RPC no banco é a segunda. */
export { requireCapability } from '@/lib/auth/require-capability'
