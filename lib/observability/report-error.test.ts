import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildEnvelope, parseDsn, parseStack, redact, reportError } from './report-error'

const DSN = 'https://abc123@o450.ingest.us.sentry.io/4507'
const ORIGINAL = process.env.SENTRY_DSN

afterEach(() => {
  vi.unstubAllGlobals()
  if (ORIGINAL === undefined) delete process.env.SENTRY_DSN
  else process.env.SENTRY_DSN = ORIGINAL
})

describe('parseDsn', () => {
  it('monta a URL do envelope a partir do DSN', () => {
    expect(parseDsn(DSN)).toEqual({
      publicKey: 'abc123',
      envelopeUrl: 'https://o450.ingest.us.sentry.io/api/4507/envelope/',
      raw: DSN,
    })
  })

  it('recusa DSN vazio, sem chave, sem projeto ou sem https', () => {
    expect(parseDsn(undefined)).toBeNull()
    expect(parseDsn('')).toBeNull()
    expect(parseDsn('não é url')).toBeNull()
    expect(parseDsn('https://o450.ingest.sentry.io/4507')).toBeNull()
    expect(parseDsn('https://abc@o450.ingest.sentry.io/')).toBeNull()
    expect(parseDsn('http://abc@o450.ingest.sentry.io/4507')).toBeNull()
  })
})

describe('parseStack', () => {
  it('converte a pilha em frames, do mais antigo ao mais recente', () => {
    const frames = parseStack(
      [
        'Error: falhou',
        '    at criarReserva (/var/task/features/reservas/service.js:10:5)',
        '    at /var/task/node_modules/next/server.js:99:1',
        '    at node:internal/process/task_queues:95:5',
      ].join('\n'),
    )
    expect(frames).toHaveLength(3)
    expect(frames.at(-1)).toMatchObject({
      function: 'criarReserva',
      filename: '/var/task/features/reservas/service.js',
      lineno: 10,
      colno: 5,
      in_app: true,
    })
    expect(frames[1]).toMatchObject({ in_app: false })
    expect(frames[0]).toMatchObject({ in_app: false })
  })

  it('sem pilha, sem frames', () => {
    expect(parseStack(undefined)).toEqual([])
  })
})

describe('buildEnvelope', () => {
  it('leva tipo, mensagem e contexto — e nenhum dado de formulário', () => {
    const dsn = parseDsn(DSN)!
    const { body, eventId } = buildEnvelope(
      new TypeError('fetch failed'),
      {
        where: 'action',
        route: '/dashboard/reservas',
        tags: { action: 'updateBooking', vazio: null },
      },
      dsn,
      new Date('2026-10-04T12:00:00Z'),
    )
    const [header, item, event] = body.split('\n').map((line) => JSON.parse(line))
    expect(header).toMatchObject({ event_id: eventId, dsn: DSN })
    expect(item).toEqual({ type: 'event' })
    expect(event.exception.values[0]).toMatchObject({ type: 'TypeError', value: 'fetch failed' })
    expect(event.tags).toEqual({
      where: 'action',
      route: '/dashboard/reservas',
      action: 'updateBooking',
    })
    expect(event.level).toBe('error')
  })

  it('aceita erro do PostgREST, que não é instância de Error', () => {
    const dsn = parseDsn(DSN)!
    const { body } = buildEnvelope(
      { message: 'permission denied', code: '42501' },
      { where: 'cron' },
      dsn,
    )
    const event = JSON.parse(body.split('\n')[2])
    expect(event.exception.values[0]).toMatchObject({
      type: 'PostgrestError 42501',
      value: 'permission denied',
    })
  })
})

describe('reportError', () => {
  it('sem SENTRY_DSN não chama a rede', async () => {
    delete process.env.SENTRY_DSN
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await reportError(new Error('x'), { where: 'teste' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('com SENTRY_DSN envia o envelope para o projeto certo', async () => {
    process.env.SENTRY_DSN = DSN
    const fetch = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    await reportError(new Error('banco fora do ar'), { where: 'cron:expiracao' })
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://o450.ingest.us.sentry.io/api/4507/envelope/')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Sentry-Auth']).toContain('sentry_key=abc123')
    expect(init.body).toContain('banco fora do ar')
  })

  it('falha do Sentry nunca vira erro para quem chamou', async () => {
    process.env.SENTRY_DSN = DSN
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede')))
    await expect(reportError(new Error('x'), { where: 'teste' })).resolves.toBeUndefined()
  })
})

describe('redact', () => {
  it('tira e-mail, CPF e telefone da mensagem', () => {
    expect(redact('Key (email)=(maria.silva+teste@exemplo.com.br) already exists')).toBe(
      'Key (email)=([e-mail]) already exists',
    )
    expect(redact('documento 123.456.789-09 inválido')).toBe('documento [número] inválido')
    expect(redact('telefone (35) 99999-0000')).toBe('telefone (35) [número]')
    expect(redact('invalid input syntax for type date: "12345678901"')).toContain('[número]')
  })

  it('mantém o que ajuda a depurar: códigos curtos, datas e ids', () => {
    const message = 'Reserva RP-ABC234 em 2026-10-04 falhou (42501) no quarto 12'
    expect(redact(message)).toBe(message)
  })

  it('o envelope já sai mascarado', () => {
    const dsn = parseDsn(DSN)!
    const { body } = buildEnvelope(new Error('falha para joao@exemplo.com'), { where: 't' }, dsn)
    expect(body).not.toContain('joao@exemplo.com')
    expect(body).toContain('[e-mail]')
  })
})
