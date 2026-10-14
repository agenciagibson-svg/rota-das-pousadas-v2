import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertLoginNotLocked, recordLoginAttempt } from './auth-rate-limit.repository'

const mocks = vi.hoisted(() => ({
  createSupabaseServiceRoleClient: vi.fn(),
  rpc: vi.fn(),
  reportError: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceRoleClient: mocks.createSupabaseServiceRoleClient,
}))
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.reportError }))

const EMAIL = 'dono@example.test'
const IP = '203.0.113.10'
const LOCKED = 'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.'
/** SQLSTATE que `assert_login_not_locked` usa para "travado" (migration 0083). */
const LOCKED_CODE = 'P0429'
const lockedError = { message: LOCKED, code: LOCKED_CODE }

/** Roda com o console.error silenciado e devolve o que foi logado. */
async function capturingErrors<T>(run: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const result = await run()
    return { result, logs: log.mock.calls.map((args) => args.map(String).join(' ')) }
  } finally {
    log.mockRestore()
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.createSupabaseServiceRoleClient.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  mocks.reportError.mockResolvedValue(undefined)
})

describe('assertLoginNotLocked (trava de login)', () => {
  it('sem trava, deixa o login seguir para a conferência da senha', async () => {
    const { logs } = await capturingErrors(() => assertLoginNotLocked(EMAIL, IP))

    expect(mocks.rpc).toHaveBeenCalledWith('assert_login_not_locked', { p_email: EMAIL, p_ip: IP })
    expect(logs).toEqual([])
    expect(mocks.reportError).not.toHaveBeenCalled()
  })

  it('consulta a trava mesmo sem endereço de origem conhecido', async () => {
    await assertLoginNotLocked(EMAIL, null)

    expect(mocks.rpc).toHaveBeenCalledWith(
      'assert_login_not_locked',
      expect.objectContaining({ p_email: EMAIL }),
    )
    const [, args] = mocks.rpc.mock.calls[0] as [string, { p_ip?: string }]
    expect(args.p_ip).toBeUndefined()
  })

  it('bloqueia com a mensagem do banco quando a RPC responde com o código da trava', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: lockedError })

    await expect(assertLoginNotLocked(EMAIL, IP)).rejects.toThrow(LOCKED)
  })

  it('a trava é reconhecida pelo código, qualquer que seja o texto da mensagem', async () => {
    const reworded = 'Acesso temporariamente bloqueado. Tente mais tarde.'
    mocks.rpc.mockResolvedValue({ data: null, error: { message: reworded, code: LOCKED_CODE } })

    await expect(assertLoginNotLocked(EMAIL, IP)).rejects.toThrow(reworded)
  })

  it('a trava em si não é tratada como falha técnica (não loga erro nem vai para o monitoramento)', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: lockedError })

    const { logs } = await capturingErrors(() =>
      assertLoginNotLocked(EMAIL, IP).catch(() => undefined),
    )

    expect(logs).toEqual([])
    expect(mocks.reportError).not.toHaveBeenCalled()
  })

  it('mensagem começando com "Muitas tentativas" mas sem o código da trava não bloqueia — é falha técnica', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: LOCKED } })

    const { logs } = await capturingErrors(() => assertLoginNotLocked(EMAIL, IP))

    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('trava de login indisponível')
    expect(mocks.reportError).toHaveBeenCalledTimes(1)
  })

  it('mensagem de trava com outro código de erro do banco também não bloqueia', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: LOCKED, code: 'P0001' } })

    await capturingErrors(() => assertLoginNotLocked(EMAIL, IP))

    expect(mocks.reportError).toHaveBeenCalledTimes(1)
  })

  it('erro do banco que não é a trava não deixa ninguém de fora — loga e avisa o monitoramento', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for function assert_login_not_locked', code: '42501' },
    })

    const { logs } = await capturingErrors(() => assertLoginNotLocked(EMAIL, IP))

    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('trava de login indisponível')
    expect(mocks.reportError).toHaveBeenCalledTimes(1)
    const [reported, context] = mocks.reportError.mock.calls[0] as [Error, { where: string }]
    expect(reported).toBeInstanceOf(Error)
    expect(reported.message).toContain('permission denied')
    expect(context).toEqual({ where: 'auth:login-lock' })
  })

  it('erro de rede na consulta não deixa ninguém de fora — loga e avisa o monitoramento', async () => {
    mocks.rpc.mockRejectedValue(new TypeError('fetch failed'))

    const { logs } = await capturingErrors(() => assertLoginNotLocked(EMAIL, IP))

    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('fetch failed')
    expect(mocks.reportError).toHaveBeenCalledTimes(1)
  })

  it('chave de serviço ausente (cliente lança ao ser criado) não deixa ninguém de fora — loga e avisa o monitoramento', async () => {
    mocks.createSupabaseServiceRoleClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada — auditoria não pode ser gravada.')
    })

    const { logs } = await capturingErrors(() => assertLoginNotLocked(EMAIL, IP))

    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(mocks.reportError).toHaveBeenCalledTimes(1)
  })

  it('falha que não é um Error (valor qualquer lançado) também não deixa ninguém de fora', async () => {
    mocks.rpc.mockRejectedValue('timeout')

    const { logs } = await capturingErrors(() => assertLoginNotLocked(EMAIL, IP))

    expect(logs).toHaveLength(1)
    expect(mocks.reportError).toHaveBeenCalledTimes(1)
  })

  it('mensagem que só menciona "Muitas tentativas" no meio do texto não bloqueia', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'erro interno: Muitas tentativas de reconexão ao banco' },
    })

    const { logs } = await capturingErrors(() => assertLoginNotLocked(EMAIL, IP))

    expect(logs).toHaveLength(1)
    expect(mocks.reportError).toHaveBeenCalledTimes(1)
  })

  it('o e-mail e o endereço de quem tenta entrar não vão para o log nem para o monitoramento', async () => {
    mocks.rpc.mockRejectedValue(new TypeError('fetch failed'))

    const { logs } = await capturingErrors(() => assertLoginNotLocked(EMAIL, IP))

    const reported = mocks.reportError.mock.calls
      .flat()
      .map((arg) => (arg instanceof Error ? arg.message : JSON.stringify(arg)))
    const everything = [...logs, ...reported].join(' ')
    expect(everything).not.toContain(EMAIL)
    expect(everything).not.toContain(IP)
  })
})

describe('recordLoginAttempt (registro da tentativa)', () => {
  it('grava a tentativa com e-mail, endereço e resultado', async () => {
    await recordLoginAttempt(EMAIL, IP, false)

    expect(mocks.rpc).toHaveBeenCalledWith('record_login_attempt', {
      p_email: EMAIL,
      p_ip: IP,
      p_success: false,
    })
  })

  it('grava login bem-sucedido como sucesso', async () => {
    await recordLoginAttempt(EMAIL, IP, true)

    expect(mocks.rpc).toHaveBeenCalledWith(
      'record_login_attempt',
      expect.objectContaining({ p_success: true }),
    )
  })

  it('sem endereço conhecido, grava a tentativa mesmo assim', async () => {
    await recordLoginAttempt(EMAIL, null, false)

    expect(mocks.rpc).toHaveBeenCalledWith(
      'record_login_attempt',
      expect.objectContaining({ p_email: EMAIL, p_ip: '', p_success: false }),
    )
  })

  it('erro do banco ao gravar nunca derruba o login — só loga', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'banco indisponível' } })

    const { logs } = await capturingErrors(() => recordLoginAttempt(EMAIL, IP, true))

    expect(logs).toHaveLength(1)
    expect(logs[0]).toContain('falha ao registrar tentativa de login')
  })

  it('erro de rede ao gravar nunca derruba o login — só loga', async () => {
    mocks.rpc.mockRejectedValue(new TypeError('fetch failed'))

    const { logs } = await capturingErrors(() => recordLoginAttempt(EMAIL, IP, false))

    expect(logs).toHaveLength(1)
  })

  it('chave de serviço ausente nunca derruba o login — só loga', async () => {
    mocks.createSupabaseServiceRoleClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada — auditoria não pode ser gravada.')
    })

    const { logs } = await capturingErrors(() => recordLoginAttempt(EMAIL, IP, false))

    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(logs).toHaveLength(1)
  })

  it('valor qualquer lançado (não Error) também não derruba o login', async () => {
    mocks.rpc.mockRejectedValue('timeout')

    await expect(capturingErrors(() => recordLoginAttempt(EMAIL, IP, false))).resolves.toBeDefined()
  })
})
