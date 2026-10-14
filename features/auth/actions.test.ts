import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signInAction, signInAdminAction, signUpAction } from './actions'

const mocks = vi.hoisted(() => ({
  requestHeaders: {} as Record<string, string>,
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  assertLoginNotLocked: vi.fn(),
  recordLoginAttempt: vi.fn(),
  getCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  reportError: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers(mocks.requestHeaders),
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signOut: mocks.signOut,
    },
  }),
}))
vi.mock('@/repositories/auth-rate-limit.repository', () => ({
  assertLoginNotLocked: mocks.assertLoginNotLocked,
  recordLoginAttempt: mocks.recordLoginAttempt,
}))
vi.mock('./services/auth.service', () => ({
  getCurrentUser: mocks.getCurrentUser,
  updateMyName: vi.fn(),
}))
vi.mock('./services/password-reset.service', () => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))
vi.mock('./services/profile.service', () => ({ saveMyProfile: vi.fn() }))
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.reportError }))

const EMAIL = 'viajante@example.test'
const PASSWORD = 'senha-de-teste-123'
const LOCKED = 'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.'

const WRONG_PASSWORD_MESSAGE = 'E-mail ou senha inválidos.'
const CONFIRM_EMAIL_MESSAGE = /^Confirme seu e-mail para entrar/
const TOO_MANY_MESSAGE = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'
const UNAVAILABLE_MESSAGE = 'Não foi possível entrar agora. Tente de novo em instantes.'

/** Erros do Supabase Auth no formato real (`AuthApiError`: message + code + status). */
const invalidCredentials = {
  message: 'Invalid login credentials',
  code: 'invalid_credentials',
  status: 400,
}
const emailNotConfirmed = {
  message: 'Email not confirmed',
  code: 'email_not_confirmed',
  status: 400,
}
const rateLimited = {
  message: 'Request rate limit reached',
  code: 'over_request_rate_limit',
  status: 429,
}

type SignInFailure = { message: string; code?: string; status?: number }

function signInFailsWith(error: SignInFailure) {
  mocks.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error })
}

/** Erros que NÃO são senha errada: mensagem esperada na tela, sem somar tentativa na trava. */
const notWrongPassword: [string, SignInFailure, string | RegExp][] = [
  ['e-mail ainda não confirmado (código)', emailNotConfirmed, CONFIRM_EMAIL_MESSAGE],
  [
    'e-mail ainda não confirmado (só a mensagem, sem código)',
    { message: 'Email not confirmed' },
    CONFIRM_EMAIL_MESSAGE,
  ],
  ['limite de requisições do Supabase (429)', rateLimited, TOO_MANY_MESSAGE],
  [
    'limite de requisições (só a mensagem "rate limit")',
    { message: 'Email rate limit exceeded' },
    TOO_MANY_MESSAGE,
  ],
  [
    'limite de requisições (só a mensagem "too many")',
    { message: 'Too many requests' },
    TOO_MANY_MESSAGE,
  ],
  [
    'Supabase Auth fora do ar (503)',
    { message: 'Service Unavailable', status: 503 },
    UNAVAILABLE_MESSAGE,
  ],
  [
    'erro interno do Supabase Auth (500)',
    { message: 'Database error querying schema', code: 'unexpected_failure', status: 500 },
    UNAVAILABLE_MESSAGE,
  ],
  ['falha de rede', { message: 'fetch failed', status: 0 }, UNAVAILABLE_MESSAGE],
  [
    'erro desconhecido sem código nem status',
    { message: 'Something went wrong' },
    UNAVAILABLE_MESSAGE,
  ],
]

/** As actions logam toda falha no console.error — silencia e devolve o resultado. */
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
  mocks.requestHeaders = { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' }
  mocks.assertLoginNotLocked.mockResolvedValue(undefined)
  mocks.recordLoginAttempt.mockResolvedValue(undefined)
  mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null })
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.reportError.mockResolvedValue(undefined)
})

describe('signInAction (login do hóspede)', () => {
  const credentials = { email: EMAIL, password: PASSWORD }

  it('login certo entra, registra a tentativa como sucesso e manda para Minhas reservas', async () => {
    const result = await signInAction(credentials)

    expect(result).toEqual({ ok: true, data: { redirectTo: '/minhas-reservas' } })
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD })
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(EMAIL, '203.0.113.10', true)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('conta travada: a senha nem é conferida e a mensagem da trava chega à tela', async () => {
    mocks.assertLoginNotLocked.mockRejectedValue(new Error(LOCKED))

    const result = await silenced(() => signInAction(credentials))

    expect(result).toMatchObject({ ok: false, error: LOCKED })
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('a trava é consultada para o e-mail e o endereço de quem tenta entrar', async () => {
    await signInAction(credentials)

    expect(mocks.assertLoginNotLocked).toHaveBeenCalledWith(EMAIL, '203.0.113.10')
  })

  it('senha errada: registra a tentativa como falha e responde "E-mail ou senha inválidos."', async () => {
    signInFailsWith(invalidCredentials)

    const result = await silenced(() => signInAction(credentials))

    expect(result).toMatchObject({ ok: false, error: WRONG_PASSWORD_MESSAGE })
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(EMAIL, '203.0.113.10', false)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('a resposta de senha errada não revela a mensagem do Supabase nem se o e-mail existe', async () => {
    signInFailsWith(invalidCredentials)

    const result = await silenced(() => signInAction(credentials))

    expect(JSON.stringify(result)).not.toMatch(/invalid login|credentials/i)
  })

  describe('endereço de origem', () => {
    it('usa o primeiro endereço do x-forwarded-for', async () => {
      mocks.requestHeaders = { 'x-forwarded-for': ' 198.51.100.7 , 10.0.0.1, 10.0.0.2' }

      await signInAction(credentials)

      expect(mocks.assertLoginNotLocked).toHaveBeenCalledWith(EMAIL, '198.51.100.7')
      expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(EMAIL, '198.51.100.7', true)
    })

    it('sem x-forwarded-for, usa o x-real-ip', async () => {
      mocks.requestHeaders = { 'x-real-ip': '198.51.100.9' }

      await signInAction(credentials)

      expect(mocks.assertLoginNotLocked).toHaveBeenCalledWith(EMAIL, '198.51.100.9')
    })

    it('sem nenhum cabeçalho de origem o login continua funcionando', async () => {
      mocks.requestHeaders = {}

      const result = await signInAction(credentials)

      expect(result.ok).toBe(true)
      expect(mocks.assertLoginNotLocked).toHaveBeenCalledWith(EMAIL, null)
      expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(EMAIL, null, true)
    })
  })

  it('dados inválidos (senha curta) nem chegam à trava nem ao Supabase', async () => {
    const result = await signInAction({ email: EMAIL, password: '123' })

    expect(result).toMatchObject({
      ok: false,
      error: 'Dados inválidos.',
      fieldErrors: { password: 'A senha deve ter ao menos 8 caracteres.' },
    })
    expect(mocks.assertLoginNotLocked).not.toHaveBeenCalled()
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('credencial inválida é reconhecida só pelo código, mesmo que o texto do Supabase mude', async () => {
    signInFailsWith({ message: 'Wrong email or password', code: 'invalid_credentials' })

    const result = await silenced(() => signInAction(credentials))

    expect(result).toMatchObject({ ok: false, error: WRONG_PASSWORD_MESSAGE })
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(EMAIL, '203.0.113.10', false)
  })

  it('credencial inválida é reconhecida só pela mensagem, quando o Supabase não manda código', async () => {
    signInFailsWith({ message: 'Invalid login credentials' })

    const result = await silenced(() => signInAction(credentials))

    expect(result).toMatchObject({ ok: false, error: WRONG_PASSWORD_MESSAGE })
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(EMAIL, '203.0.113.10', false)
  })

  it('senha errada soma exatamente uma tentativa falha na trava', async () => {
    signInFailsWith(invalidCredentials)

    await silenced(() => signInAction(credentials))

    expect(mocks.recordLoginAttempt).toHaveBeenCalledTimes(1)
  })

  it('e-mail ainda não confirmado: pede para confirmar o e-mail em vez de culpar a senha', async () => {
    signInFailsWith(emailNotConfirmed)

    const result = await silenced(() => signInAction(credentials))

    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(CONFIRM_EMAIL_MESSAGE) })
    expect(result).not.toMatchObject({ error: WRONG_PASSWORD_MESSAGE })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('e-mail ainda não confirmado não conta como senha errada para a trava', async () => {
    signInFailsWith(emailNotConfirmed)

    await silenced(() => signInAction(credentials))

    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
  })

  it('indisponibilidade do Supabase Auth não conta como senha errada para a trava', async () => {
    signInFailsWith({ message: 'fetch failed', status: 503 })

    const result = await silenced(() => signInAction(credentials))

    expect(result).toMatchObject({ ok: false, error: UNAVAILABLE_MESSAGE })
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
  })

  it('cinco cliques durante uma instabilidade não somam nenhuma tentativa na trava', async () => {
    signInFailsWith({ message: 'Service Unavailable', status: 503 })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await silenced(() => signInAction(credentials))
    }

    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(5)
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
  })

  describe('erro que não é senha errada: mensagem própria e nenhuma tentativa gravada', () => {
    it.each(notWrongPassword)('%s', async (_label, error, expected) => {
      signInFailsWith(error)

      const result = await silenced(() => signInAction(credentials))

      expect(result).toMatchObject({ ok: false, error: expect.stringMatching(expected) })
      expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it.each(notWrongPassword)(
      'nunca devolve a mensagem crua do Supabase: %s',
      async (_label, error) => {
        signInFailsWith(error)

        const result = await silenced(() => signInAction(credentials))

        expect(JSON.stringify(result)).not.toContain(error.message)
      },
    )
  })
})

describe('signInAdminAction (login do painel administrativo)', () => {
  const ADMIN_EMAIL = 'admin@example.test'
  const credentials = { email: ADMIN_EMAIL, password: PASSWORD }

  it('conta de staff entra e vai para /admin', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', platformRole: 'master' })

    const result = await signInAdminAction(credentials)

    expect(result).toEqual({ ok: true, data: { redirectTo: '/admin' } })
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('senha certa em conta sem papel de plataforma: desloga e recusa o acesso', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', platformRole: null })

    const result = await silenced(() => signInAdminAction(credentials))

    expect(result).toMatchObject({
      ok: false,
      error: 'Esta conta não tem acesso ao painel administrativo.',
    })
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('conta travada: a senha nem é conferida', async () => {
    mocks.assertLoginNotLocked.mockRejectedValue(new Error(LOCKED))

    const result = await silenced(() => signInAdminAction(credentials))

    expect(result).toMatchObject({ ok: false, error: LOCKED })
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('senha errada registra a tentativa como falha', async () => {
    signInFailsWith(invalidCredentials)

    const result = await silenced(() => signInAdminAction(credentials))

    expect(result).toMatchObject({ ok: false, error: WRONG_PASSWORD_MESSAGE })
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(ADMIN_EMAIL, '203.0.113.10', false)
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
  })

  it('login de staff registra a tentativa como sucesso', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', platformRole: 'master' })

    await signInAdminAction(credentials)

    expect(mocks.recordLoginAttempt).toHaveBeenCalledTimes(1)
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(ADMIN_EMAIL, '203.0.113.10', true)
  })

  it('senha certa em conta sem papel de plataforma não soma tentativa falha na trava', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', platformRole: null })

    await silenced(() => signInAdminAction(credentials))

    expect(mocks.recordLoginAttempt).toHaveBeenCalledTimes(1)
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(ADMIN_EMAIL, '203.0.113.10', true)
  })

  it('e-mail ainda não confirmado: pede para confirmar e não soma tentativa na trava', async () => {
    signInFailsWith(emailNotConfirmed)

    const result = await silenced(() => signInAdminAction(credentials))

    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(CONFIRM_EMAIL_MESSAGE) })
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
  })

  describe('erro que não é senha errada: mensagem própria, nenhuma tentativa gravada e ninguém entra', () => {
    it.each(notWrongPassword)('%s', async (_label, error, expected) => {
      signInFailsWith(error)

      const result = await silenced(() => signInAdminAction(credentials))

      expect(result).toMatchObject({ ok: false, error: expect.stringMatching(expected) })
      expect(mocks.recordLoginAttempt).not.toHaveBeenCalled()
      expect(mocks.getCurrentUser).not.toHaveBeenCalled()
      expect(mocks.signOut).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })
  })
})

describe('signUpAction (cadastro)', () => {
  const form = { name: 'Viajante Teste', email: EMAIL, password: PASSWORD }

  it('cria a conta levando o nome para o cadastro', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null })

    const result = await signUpAction(form)

    expect(result).toEqual({
      ok: true,
      data: { needsEmailConfirmation: false, redirectTo: '/minhas-reservas' },
    })
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      options: { data: { full_name: 'Viajante Teste' } },
    })
  })

  it('projeto que exige confirmação de e-mail: avisa que falta confirmar', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null })

    const result = await signUpAction(form)

    expect(result).toMatchObject({ ok: true, data: { needsEmailConfirmation: true } })
  })

  describe('erros do Supabase chegam em português', () => {
    const cases: [string, string, string][] = [
      [
        'e-mail já cadastrado',
        'User already registered',
        'Este e-mail já tem uma conta. Entre com sua senha para continuar.',
      ],
      [
        'e-mail já cadastrado (variação da mensagem)',
        'A user with this email address has already been registered',
        'Este e-mail já tem uma conta. Entre com sua senha para continuar.',
      ],
      [
        'senha fraca',
        'Password should be at least 6 characters.',
        'Escolha uma senha mais forte: pelo menos 8 caracteres, sem ser uma senha comum.',
      ],
      [
        'senha vazada/comum',
        'Password is known to be weak and easy to guess, please choose a different one.',
        'Escolha uma senha mais forte: pelo menos 8 caracteres, sem ser uma senha comum.',
      ],
      [
        'limite de envio de e-mails',
        'Email rate limit exceeded',
        'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.',
      ],
      [
        'intervalo mínimo entre tentativas',
        'For security purposes, you can only request this after 42 seconds.',
        'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.',
      ],
      ['e-mail inválido', 'Email address "x@invalido" is invalid', 'Confira o e-mail informado.'],
      [
        'erro desconhecido',
        'Database error saving new user',
        'Não foi possível criar a conta agora. Tente de novo em instantes.',
      ],
      [
        'cadastro desativado no projeto',
        'Signups not allowed for this instance',
        'Não foi possível criar a conta agora. Tente de novo em instantes.',
      ],
    ]

    it.each(cases)('%s', async (_label, supabaseMessage, expected) => {
      mocks.signUp.mockResolvedValue({
        data: { session: null },
        error: { message: supabaseMessage },
      })

      const result = await silenced(() => signUpAction(form))

      expect(result).toMatchObject({ ok: false, error: expected })
    })

    it.each(cases)(
      'nunca devolve a mensagem crua em inglês: %s',
      async (_label, supabaseMessage) => {
        mocks.signUp.mockResolvedValue({
          data: { session: null },
          error: { message: supabaseMessage },
        })

        const result = await silenced(() => signUpAction(form))

        expect(JSON.stringify(result)).not.toContain(supabaseMessage)
      },
    )
  })

  it('cadastro que falhou não é tratado como sucesso (nada de revalidar a sessão)', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'User already registered' },
    })

    await silenced(() => signUpAction(form))

    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('dados inválidos (nome curto) nem chegam ao Supabase', async () => {
    const result = await signUpAction({ ...form, name: 'A' })

    expect(result).toMatchObject({ ok: false, fieldErrors: { name: 'Informe seu nome.' } })
    expect(mocks.signUp).not.toHaveBeenCalled()
  })
})
