import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  requestEmailCodeAction,
  requestPasswordResetAction,
  signInAction,
  signInAdminAction,
  signUpAction,
} from './actions'
import { CAPTCHA_FAILED_MESSAGE, captchaOption, isCaptchaError } from './captcha'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
  assertLoginNotLocked: vi.fn(),
  recordLoginAttempt: vi.fn(),
  verifyTurnstileToken: vi.fn(),
  requestPasswordReset: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signInWithOtp: mocks.signInWithOtp,
      signOut: mocks.signOut,
    },
  }),
}))
vi.mock('@/repositories/auth-rate-limit.repository', () => ({
  assertLoginNotLocked: mocks.assertLoginNotLocked,
  recordLoginAttempt: mocks.recordLoginAttempt,
}))
vi.mock('@/lib/turnstile', () => ({ verifyTurnstileToken: mocks.verifyTurnstileToken }))
vi.mock('./services/auth.service', () => ({
  getCurrentUser: vi.fn(async () => ({ platformRole: 'master' })),
  updateMyName: vi.fn(),
}))
vi.mock('./services/password-reset.service', () => ({
  requestPasswordReset: mocks.requestPasswordReset,
  resetPassword: vi.fn(),
}))
vi.mock('./services/profile.service', () => ({ saveMyProfile: vi.fn() }))
vi.mock('./services/account-deletion.service', () => ({ deleteMyAccount: vi.fn() }))
vi.mock('@/lib/observability/report-error', () => ({ reportError: vi.fn() }))

const EMAIL = 'viajante@example.test'
const PASSWORD = 'senha-de-teste-123'
const TOKEN = 'token-sintetico-do-turnstile'
/** Resposta real do Supabase Auth com a proteção por CAPTCHA ligada. */
const captchaFailed = {
  message: 'captcha protection: request disallowed (invalid-input-response)',
  code: 'captcha_failed',
  status: 400,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.signInWithPassword.mockResolvedValue({ error: null })
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null })
  mocks.signInWithOtp.mockResolvedValue({ error: null })
  mocks.verifyTurnstileToken.mockResolvedValue(true)
})

describe('captcha helpers', () => {
  it('só manda captchaToken quando há token', () => {
    expect(captchaOption(TOKEN)).toEqual({ captchaToken: TOKEN })
    expect(captchaOption(undefined)).toEqual({})
    expect(captchaOption('')).toEqual({})
  })

  it('reconhece a recusa do Supabase pelo código ou pela mensagem', () => {
    expect(isCaptchaError(captchaFailed)).toBe(true)
    expect(isCaptchaError({ message: 'captcha protection: request disallowed (no captcha)' })).toBe(
      true,
    )
    expect(
      isCaptchaError({ message: 'Invalid login credentials', code: 'invalid_credentials' }),
    ).toBe(false)
    expect(isCaptchaError(null)).toBe(false)
  })
})

describe('login com senha', () => {
  it('repassa o token do CAPTCHA para o Supabase', async () => {
    await signInAction({ email: EMAIL, password: PASSWORD, captchaToken: TOKEN })
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      options: { captchaToken: TOKEN },
    })
  })

  it('admin também repassa o token', async () => {
    await signInAdminAction({ email: EMAIL, password: PASSWORD, captchaToken: TOKEN })
    expect(mocks.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ options: { captchaToken: TOKEN } }),
    )
  })

  it('CAPTCHA recusado: mensagem própria e NÃO conta como senha errada', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: captchaFailed })
    const result = await signInAction({ email: EMAIL, password: PASSWORD, captchaToken: TOKEN })
    expect(result).toEqual({ ok: false, error: CAPTCHA_FAILED_MESSAGE })
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
  })
})

describe('cadastro', () => {
  it('repassa o token dentro de options', async () => {
    await signUpAction({ name: 'Ana Teste', email: EMAIL, password: PASSWORD, captchaToken: TOKEN })
    expect(mocks.signUp.mock.calls[0]?.[0].options).toMatchObject({ captchaToken: TOKEN })
  })

  it('CAPTCHA recusado vira mensagem em português', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: captchaFailed })
    const result = await signUpAction({ name: 'Ana Teste', email: EMAIL, password: PASSWORD })
    expect(result).toEqual({ ok: false, error: CAPTCHA_FAILED_MESSAGE })
  })
})

describe('código por e-mail', () => {
  it('repassa o token dentro de options', async () => {
    await requestEmailCodeAction({ email: EMAIL, captchaToken: TOKEN })
    expect(mocks.signInWithOtp.mock.calls[0]?.[0].options).toMatchObject({ captchaToken: TOKEN })
  })

  it('CAPTCHA recusado vira mensagem em português', async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: captchaFailed })
    const result = await requestEmailCodeAction({ email: EMAIL, captchaToken: TOKEN })
    expect(result).toEqual({ ok: false, error: CAPTCHA_FAILED_MESSAGE })
  })
})

describe('esqueci a senha (CAPTCHA conferido no nosso servidor)', () => {
  it('token válido: segue para o envio do link', async () => {
    const result = await requestPasswordResetAction({
      email: EMAIL,
      audience: 'hospede',
      captchaToken: TOKEN,
    })
    expect(result).toEqual({ ok: true, data: { sent: true } })
    expect(mocks.verifyTurnstileToken).toHaveBeenCalledWith(TOKEN, '203.0.113.7')
    expect(mocks.requestPasswordReset).toHaveBeenCalled()
  })

  it('token recusado: não toca no e-mail', async () => {
    mocks.verifyTurnstileToken.mockResolvedValue(false)
    const result = await requestPasswordResetAction({ email: EMAIL, audience: 'hospede' })
    expect(result).toEqual({ ok: false, error: CAPTCHA_FAILED_MESSAGE })
    expect(mocks.verifyTurnstileToken).toHaveBeenCalledWith('', '203.0.113.7')
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled()
  })
})
