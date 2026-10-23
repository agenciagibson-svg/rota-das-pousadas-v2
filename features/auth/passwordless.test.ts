import { describe, expect, it } from 'vitest'
import {
  authCallbackPath,
  authErrorMessage,
  authRedirectOrigin,
  emailLinkTypeFrom,
  guestLoginPath,
  isBookingNextPath,
  isEmbeddedBrowser,
  isPlausibleTokenHash,
  nameFromIdentityMetadata,
  nextFromLinkParam,
  resendSecondsLeft,
} from './passwordless'
import { emailCodeRequestSchema, emailCodeVerifySchema, emailLinkConfirmSchema } from './schemas'
import { safeNextPath } from './profile'

const SITE = 'https://rotadaspousadas.com.br'
const BOOKING = '/pousada/serra-azul/reservar?checkin=2026-11-10&checkout=2026-11-12&guests=2'

describe('emailCodeRequestSchema', () => {
  it('aceita e-mail válido (com espaços em volta)', () => {
    const r = emailCodeRequestSchema.safeParse({ email: '  ana@rota.com ' })
    expect(r.success && r.data.email).toBe('ana@rota.com')
  })

  it.each(['', 'ana', 'ana@', '@rota.com', 'ana rota@x.com'])('recusa e-mail "%s"', (email) => {
    expect(emailCodeRequestSchema.safeParse({ email }).success).toBe(false)
  })

  it('aceita o next como texto curto e recusa texto enorme', () => {
    expect(emailCodeRequestSchema.safeParse({ email: 'a@b.co', next: BOOKING }).success).toBe(true)
    expect(
      emailCodeRequestSchema.safeParse({ email: 'a@b.co', next: `/${'x'.repeat(600)}` }).success,
    ).toBe(false)
  })
})

describe('emailCodeVerifySchema', () => {
  const base = { email: 'ana@rota.com' }

  it('aceita exatamente 6 números', () => {
    expect(emailCodeVerifySchema.safeParse({ ...base, code: '012345' }).success).toBe(true)
    expect(emailCodeVerifySchema.safeParse({ ...base, code: ' 012345 ' }).success).toBe(true)
  })

  it.each(['', '12345', '1234567', '12a456', '12 456', '１２３４５６'])(
    'recusa código "%s"',
    (code) => {
      const r = emailCodeVerifySchema.safeParse({ ...base, code })
      expect(r.success).toBe(false)
    },
  )

  it('código vazio pede para digitar; formato errado explica os 6 números', () => {
    const empty = emailCodeVerifySchema.safeParse({ ...base, code: '' })
    const short = emailCodeVerifySchema.safeParse({ ...base, code: '123' })
    expect(empty.success ? '' : empty.error.issues[0]?.message).toBe(
      'Digite o código que enviamos.',
    )
    expect(short.success ? '' : short.error.issues[0]?.message).toBe('O código tem 6 números.')
  })
})

describe('emailLinkConfirmSchema', () => {
  it('aceita token_hash do Supabase e os tipos de link de entrada', () => {
    for (const type of ['email', 'magiclink', 'signup']) {
      const r = emailLinkConfirmSchema.safeParse({ tokenHash: 'pkce_0123456789abcdef', type })
      expect(r.success).toBe(true)
    }
  })

  it('recusa recovery (tem fluxo próprio) e token com caracteres estranhos', () => {
    expect(
      emailLinkConfirmSchema.safeParse({ tokenHash: '0123456789abcdef', type: 'recovery' }).success,
    ).toBe(false)
    expect(
      emailLinkConfirmSchema.safeParse({ tokenHash: '0123456789<script>', type: 'email' }).success,
    ).toBe(false)
  })
})

describe('safeNextPath (destino depois de entrar)', () => {
  it.each([
    ['//evil.example', null],
    ['/\\evil.example', null],
    ['https://evil.example/x', null],
    ['javascript:alert(1)', null],
    ['/minhas-reservas\n', null],
    ['', null],
    [BOOKING, BOOKING],
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected)
  })
})

describe('isBookingNextPath', () => {
  it.each([
    [BOOKING, true],
    ['/pousada/serra-azul/reservar', true],
    ['/pousada/serra-azul/reservar/abc/pagar', true],
    ['/pousada/serra-azul', false],
    ['/pousada/serra-azul/reservarx', false],
    ['/minhas-reservas', false],
    ['//pousada/x/reservar', false],
    [undefined, false],
  ])('%s → %s', (next, expected) => {
    expect(isBookingNextPath(next)).toBe(expected)
  })
})

describe('authCallbackPath e guestLoginPath', () => {
  it('leva o next codificado e descarta destino externo', () => {
    expect(authCallbackPath(BOOKING)).toBe(`/auth/callback?next=${encodeURIComponent(BOOKING)}`)
    expect(authCallbackPath('//evil.example')).toBe('/auth/callback')
    expect(authCallbackPath(undefined)).toBe('/auth/callback')
  })

  it('volta ao login com o destino e o aviso', () => {
    expect(guestLoginPath('/pousada/a/reservar', 'retorno')).toBe(
      '/login?next=%2Fpousada%2Fa%2Freservar&erro=retorno',
    )
    expect(guestLoginPath('https://evil.example')).toBe('/login')
  })
})

describe('nextFromLinkParam (next do link do e-mail)', () => {
  const origins = [SITE]

  it('aceita caminho interno', () => {
    expect(nextFromLinkParam(BOOKING, origins)).toBe(BOOKING)
  })

  it('desembrulha o {{ .RedirectTo }} do nosso /auth/callback (codificado ou não)', () => {
    const encoded = `${SITE}/auth/callback?next=${encodeURIComponent(BOOKING)}`
    const raw = `${SITE}/auth/callback?next=${BOOKING}`
    expect(nextFromLinkParam(encoded, origins)).toBe(BOOKING)
    expect(nextFromLinkParam(raw, origins)).toBe(BOOKING)
  })

  it('RedirectTo sem next ou caído no Site URL vira o destino padrão', () => {
    expect(nextFromLinkParam(`${SITE}/auth/callback`, origins)).toBeNull()
    expect(nextFromLinkParam(SITE, origins)).toBeNull()
  })

  it.each([
    'https://evil.example/pousada/x/reservar',
    'https://rotadaspousadas.com.br.evil.example/x',
    '//evil.example',
    `${SITE}/auth/callback?next=//evil.example`,
    `${SITE}/auth/callback?next=https://evil.example`,
    `${SITE}/auth/callback?next=%2F%2Fevil.example`,
    'javascript:alert(1)',
    'não é url',
  ])('recusa %s', (value) => {
    expect(nextFromLinkParam(value, origins)).toBeNull()
  })
})

describe('emailLinkTypeFrom e isPlausibleTokenHash', () => {
  it('só tipos de entrada', () => {
    expect(emailLinkTypeFrom('email')).toBe('email')
    expect(emailLinkTypeFrom('magiclink')).toBe('magiclink')
    expect(emailLinkTypeFrom('recovery')).toBeNull()
    expect(emailLinkTypeFrom(null)).toBeNull()
  })

  it('token_hash', () => {
    expect(isPlausibleTokenHash('pkce_a1b2c3d4e5f6')).toBe(true)
    expect(isPlausibleTokenHash('curto')).toBe(false)
    expect(isPlausibleTokenHash('a1b2c3d4e5f6"><x')).toBe(false)
    expect(isPlausibleTokenHash(undefined)).toBe(false)
  })
})

describe('authErrorMessage', () => {
  it('traduz só os códigos conhecidos', () => {
    expect(authErrorMessage('retorno')).toMatch(/código por e-mail/)
    expect(authErrorMessage('link')).toMatch(/código novo/)
    expect(authErrorMessage('<script>')).toBeNull()
    expect(authErrorMessage(undefined)).toBeNull()
  })
})

describe('authRedirectOrigin', () => {
  const base = { siteUrl: SITE, nodeEnv: 'production' }

  it('produção usa sempre o site oficial, ignorando o Host', () => {
    expect(authRedirectOrigin({ ...base, vercelEnv: 'production', host: 'evil.example' })).toBe(
      SITE,
    )
    expect(
      authRedirectOrigin({ ...base, vercelEnv: 'production', host: 'rota-git-x.vercel.app' }),
    ).toBe(SITE)
  })

  it('preview da Vercel volta para o próprio domínio do preview', () => {
    expect(
      authRedirectOrigin({ ...base, vercelEnv: 'preview', host: 'rota-git-x-gibson.vercel.app' }),
    ).toBe('https://rota-git-x-gibson.vercel.app')
    expect(authRedirectOrigin({ ...base, vercelEnv: 'preview', host: 'evil.example' })).toBe(SITE)
    expect(
      authRedirectOrigin({ ...base, vercelEnv: 'preview', host: 'x.vercel.app.evil.example' }),
    ).toBe(SITE)
  })

  it('desenvolvimento volta para o localhost', () => {
    expect(
      authRedirectOrigin({
        siteUrl: SITE,
        vercelEnv: undefined,
        nodeEnv: 'development',
        host: 'localhost:3000',
      }),
    ).toBe('http://localhost:3000')
  })
})

describe('isEmbeddedBrowser', () => {
  it.each([
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0',
      true,
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0]',
      true,
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      false,
    ],
    [
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
      false,
    ],
    [null, false],
  ])('%s → %s', (ua, expected) => {
    expect(isEmbeddedBrowser(ua)).toBe(expected)
  })
})

describe('nameFromIdentityMetadata', () => {
  it('prefere full_name, depois name, depois nome + sobrenome', () => {
    expect(nameFromIdentityMetadata({ full_name: ' Maria  Silva ', name: 'X' })).toBe('Maria Silva')
    expect(nameFromIdentityMetadata({ name: 'Joao Souza' })).toBe('Joao Souza')
    expect(nameFromIdentityMetadata({ given_name: 'Ana', family_name: 'Lima' })).toBe('Ana Lima')
  })

  it('ignora o que não é texto', () => {
    expect(nameFromIdentityMetadata({ full_name: 42 })).toBe('')
    expect(nameFromIdentityMetadata(null)).toBe('')
  })
})

describe('resendSecondsLeft', () => {
  it('conta 60s a partir do envio e nunca fica negativo', () => {
    expect(resendSecondsLeft(null, 1_000)).toBe(0)
    expect(resendSecondsLeft(0, 0)).toBe(60)
    expect(resendSecondsLeft(0, 59_500)).toBe(1)
    expect(resendSecondsLeft(0, 60_000)).toBe(0)
    expect(resendSecondsLeft(0, 120_000)).toBe(0)
  })
})
