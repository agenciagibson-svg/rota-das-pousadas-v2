/**
 * Auth feature — superfície pública (client-safe).
 * O service (getCurrentUser) é server-only e deve ser importado via
 * `@/server/queries` (getCurrentUser) ou direto do arquivo do service.
 */
export { LoginForm } from './components/login-form'
export { SignupForm } from './components/signup-form'
export { LogoutButton } from './components/logout-button'
export { loginSchema, signupSchema, type LoginInput, type SignupInput } from './schemas'
export type { SessionUser, TenantMembership } from './types'
