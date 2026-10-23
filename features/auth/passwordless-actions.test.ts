import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  confirmEmailLinkAction,
  requestEmailCodeAction,
  startGoogleSignInAction,
  verifyEmailCodeAction,
} from './actions'

const SUPABASE_URL = 'https://proj.supabase.co'

const mocks = vi.hoisted(() => ({
  requestHeaders: {} as Record<string, string>,
  env: { google: true },
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  assertLoginNotLocked: vi.fn(),
  recordLoginAttempt: vi.fn(),
  revalidatePath: vi.fn(),
  reportError: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers(mocks.requestHeaders),
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/env', () => ({
  publicEnv: {
    siteUrl: 'https://rotadaspousadas.com.br',
    supabaseUrl: 'https://proj.supabase.co',
    supabaseAnonKey: 'anon',
  },
  isSupabaseConfigured: () => true,
  isGoogleAuthEnabled: () => mocks.env.google,
}))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
      signInWithOAuth: mocks.signInWithOAuth,
    },
  }),
}))
vi.mock('@/repositories/auth-rate-limit.repository', () => ({
  assertLoginNotLocked: mocks.assertLoginNotLocked,
  recordLoginAttempt: mocks.recordLoginAttempt,
}))
vi.mock('@/repositories/profiles.repository', () => ({
  getProfileWithRoles: vi.fn(),
  updateProfileName: vi.fn(),
}))
vi.mock('./services/auth.service', () => ({ getCurrentUser: vi.fn(), updateMyName: vi.fn() }))
vi.mock('./services/password-reset.service', () => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))
vi.mock('./services/profile.service', () => ({ saveMyProfile: vi.fn() }))
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.reportError }))

const EMAIL = 'viajante@example.test'
const IP = '203.0.113.10'
const BOOKING = '/pousada/serra-azul/reservar?checkin=2026-11-10&guests=2'
const LOCKED = 'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.'
const WRONG_CODE = 'Código inválido ou vencido. Confira os números ou peça um código novo.'
const TOO_MANY = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'
const UNAVAILABLE = 'Não foi possível entrar agora. Tente de novo em instantes.'

async function silenced<T>(run: () => Promise<T>): Promise<T> {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    return await run()
  } finally {
    log.mockRestore()
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.env.google = true
  mocks.requestHeaders = { 'x-forwarded-for': `${IP}, 10.0.0.1`, host: 'rotadaspousadas.com.br' }
  mocks.assertLoginNotLocked.mockResolvedValue(undefined)
  mocks.recordLoginAttempt.mockResolvedValue(undefined)
  mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null })
  mocks.verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mocks.reportError.mockResolvedValue(undefined)
})

describe('requestEmailCodeAction (receber código por e-mail)', () => {
  it('envia o código criando a conta se preciso, com o link de volta para a reserva', async () => {
    const result = await requestEmailCodeAction({ email: ' Viajante@Example.test ', next: BOOKING })

    expect(result).toEqual({ ok: true, data: { sent: true } })
    expect(mocks.assertLoginNotLocked).toHaveBeenCalledWith(EMAIL, IP)
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: EMAIL,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `https://rotadaspousadas.com.br/auth/callback?next=${encodeURIComponent(BOOKING)}`,
      },
    })
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
  })

  it('next externo é descartado no link do e-mail', async () => {
    await requestEmailCodeAction({ email: EMAIL, next: '//evil.example' })

    expect(mocks.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'https://rotadaspousadas.com.br/auth/callback',
        }),
      }),
    )
  })

  it('Host forjado em produção não muda o link do e-mail', async () => {
    mocks.requestHeaders = { host: 'evil.example', 'x-forwarded-host': 'evil.example' }

    await requestEmailCodeAction({ email: EMAIL })

    expect(mocks.signInWithOtp.mock.calls[0]?.[0].options.emailRedirectTo).toBe(
      'https://rotadaspousadas.com.br/auth/callback',
    )
  })

  it('endereço travado não recebe mais e-mails até a trava vencer', async () => {
    mocks.assertLoginNotLocked.mockRejectedValue(new Error(LOCKED))

    const result = await silenced(() => requestEmailCodeAction({ email: EMAIL }))

    expect(result).toMatchObject({ ok: false, error: LOCKED })
    expect(mocks.signInWithOtp).not.toHaveBeenCalled()
  })

  it('limite de envio do Supabase vira mensagem em português', async () => {
    mocks.signInWithOtp.mockResolvedValue({
      data: {},
      error: {
        message: 'For security purposes, you can only request this after 42 seconds.',
        status: 429,
      },
    })

    const result = await silenced(() => requestEmailCodeAction({ email: EMAIL }))

    expect(result).toMatchObject({ ok: false, error: TOO_MANY })
  })

  it('falha do serviço não revela a mensagem crua e vai para o Sentry', async () => {
    mocks.signInWithOtp.mockResolvedValue({
      data: {},
      error: { message: 'Error sending magic link email', status: 500 },
    })

    const result = await silenced(() => requestEmailCodeAction({ email: EMAIL }))

    expect(result).toMatchObject({ ok: false, error: UNAVAILABLE })
    expect(JSON.stringify(result)).not.toMatch(/magic link/i)
    expect(mocks.reportError).toHaveBeenCalled()
  })

  it('e-mail inválido nem chega ao Supabase', async () => {
    const result = await requestEmailCodeAction({ email: 'nao-e-email' })

    expect(result).toMatchObject({ ok: false, fieldErrors: { email: 'E-mail inválido.' } })
    expect(mocks.signInWithOtp).not.toHaveBeenCalled()
  })
})

describe('verifyEmailCodeAction (digitar o código)', () => {
  it('código certo entra, registra sucesso e volta para a reserva', async () => {
    const result = await verifyEmailCodeAction({ email: EMAIL, code: '123456', next: BOOKING })

    expect(result).toEqual({ ok: true, data: { redirectTo: BOOKING } })
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: EMAIL, token: '123456', type: 'email' })
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(EMAIL, IP, true)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('sem next (ou next externo) vai para Minhas reservas', async () => {
    const a = await verifyEmailCodeAction({ email: EMAIL, code: '123456' })
    const b = await verifyEmailCodeAction({
      email: EMAIL,
      code: '123456',
      next: 'https://evil.example',
    })

    expect(a).toEqual({ ok: true, data: { redirectTo: '/minhas-reservas' } })
    expect(b).toEqual({ ok: true, data: { redirectTo: '/minhas-reservas' } })
  })

  it('código errado conta como tentativa falha na trava e a mensagem é neutra', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Token has expired or is invalid', code: 'otp_expired', status: 403 },
    })

    const result = await silenced(() => verifyEmailCodeAction({ email: EMAIL, code: '000000' }))

    expect(result).toMatchObject({ ok: false, error: WRONG_CODE })
    expect(mocks.recordLoginAttempt).toHaveBeenCalledTimes(1)
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(EMAIL, IP, false)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toMatch(/expired|invalid|conta/i)
  })

  it('travado: o código nem é conferido', async () => {
    mocks.assertLoginNotLocked.mockRejectedValue(new Error(LOCKED))

    const result = await silenced(() => verifyEmailCodeAction({ email: EMAIL, code: '123456' }))

    expect(result).toMatchObject({ ok: false, error: LOCKED })
    expect(mocks.verifyOtp).not.toHaveBeenCalled()
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
  })

  it('instabilidade do Supabase não soma tentativa falha', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Service Unavailable', status: 503 },
    })

    const result = await silenced(() => verifyEmailCodeAction({ email: EMAIL, code: '123456' }))

    expect(result).toMatchObject({ ok: false, error: UNAVAILABLE })
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
  })

  it('código fora do formato nem chega à trava nem ao Supabase', async () => {
    const result = await verifyEmailCodeAction({ email: EMAIL, code: '12ab56' })

    expect(result).toMatchObject({ ok: false, fieldErrors: { code: 'O código tem 6 números.' } })
    expect(mocks.assertLoginNotLocked).not.toHaveBeenCalled()
    expect(mocks.verifyOtp).not.toHaveBeenCalled()
  })
})

describe('confirmEmailLinkAction (link do e-mail em /auth/confirm)', () => {
  const link = { tokenHash: 'pkce_0123456789abcdef', type: 'email' as const }

  it('troca o token_hash pela sessão e volta para o next validado', async () => {
    const result = await confirmEmailLinkAction({ ...link, next: BOOKING })

    expect(result).toEqual({ ok: true, data: { redirectTo: BOOKING } })
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: link.tokenHash, type: 'email' })
  })

  it('next externo vira Minhas reservas', async () => {
    const result = await confirmEmailLinkAction({ ...link, next: '//evil.example' })

    expect(result).toEqual({ ok: true, data: { redirectTo: '/minhas-reservas' } })
  })

  it('link vencido ou usado: mensagem clara', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email link is invalid or has expired', code: 'otp_expired', status: 403 },
    })

    const result = await silenced(() => confirmEmailLinkAction(link))

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/venceu ou já foi usado/),
    })
  })

  it('tipo recovery é recusado (tem fluxo próprio)', async () => {
    const result = await confirmEmailLinkAction({ ...link, type: 'recovery' })

    expect(result.ok).toBe(false)
    expect(mocks.verifyOtp).not.toHaveBeenCalled()
  })
})

describe('startGoogleSignInAction (Continuar com Google)', () => {
  it('pede a URL do Google sem redirecionar no servidor e volta pelo /auth/callback', async () => {
    const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&code_challenge=x`
    mocks.signInWithOAuth.mockResolvedValue({ data: { url }, error: null })

    const result = await startGoogleSignInAction({ next: BOOKING })

    expect(result).toEqual({ ok: true, data: { url } })
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `https://rotadaspousadas.com.br/auth/callback?next=${encodeURIComponent(BOOKING)}`,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    })
  })

  it('preview da Vercel volta para o próprio preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    mocks.requestHeaders = { host: 'rota-git-x-gibson.vercel.app' }
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: `${SUPABASE_URL}/auth/v1/authorize?provider=google` },
      error: null,
    })

    await startGoogleSignInAction({})

    expect(mocks.signInWithOAuth.mock.calls[0]?.[0].options.redirectTo).toBe(
      'https://rota-git-x-gibson.vercel.app/auth/callback',
    )
    vi.unstubAllEnvs()
  })

  it('desligado pela variável: recusa sem chamar o Supabase', async () => {
    mocks.env.google = false

    const result = await silenced(() => startGoogleSignInAction({}))

    expect(result).toMatchObject({
      ok: false,
      error: 'Entrar com Google não está disponível agora.',
    })
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled()
  })

  it('URL de autorização fora do Supabase não é devolvida ao navegador', async () => {
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://evil.example/authorize' },
      error: null,
    })

    const result = await silenced(() => startGoogleSignInAction({}))

    expect(result).toMatchObject({ ok: false, error: UNAVAILABLE })
  })

  it('erro do provedor (Google desligado no Supabase) vira mensagem genérica', async () => {
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: 'Unsupported provider: provider is not enabled', status: 400 },
    })

    const result = await silenced(() => startGoogleSignInAction({}))

    expect(result).toMatchObject({ ok: false, error: UNAVAILABLE })
    expect(JSON.stringify(result)).not.toMatch(/provider/i)
  })
})
