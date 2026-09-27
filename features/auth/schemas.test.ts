import { describe, it, expect } from 'vitest'
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from './schemas'
import { parseResetAudience, RESET_REDIRECT } from './password-reset'

describe('loginSchema', () => {
  it('aceita credenciais válidas', () => {
    const r = loginSchema.safeParse({ email: 'ana@rota.com', password: 'segredo123' })
    expect(r.success).toBe(true)
  })

  it('rejeita e-mail inválido', () => {
    const r = loginSchema.safeParse({ email: 'não-email', password: 'segredo123' })
    expect(r.success).toBe(false)
  })

  it('rejeita senha curta', () => {
    const r = loginSchema.safeParse({ email: 'ana@rota.com', password: '123' })
    expect(r.success).toBe(false)
  })
})

describe('signupSchema', () => {
  it('aceita cadastro válido', () => {
    const r = signupSchema.safeParse({ name: 'Ana', email: 'ana@rota.com', password: 'segredo123' })
    expect(r.success).toBe(true)
  })

  it('rejeita nome muito curto', () => {
    const r = signupSchema.safeParse({ name: 'A', email: 'ana@rota.com', password: 'segredo123' })
    expect(r.success).toBe(false)
  })

  it('exige todos os campos', () => {
    const r = signupSchema.safeParse({ email: 'ana@rota.com' })
    expect(r.success).toBe(false)
  })
})

describe('esqueci minha senha', () => {
  it('pede e-mail válido', () => {
    expect(
      forgotPasswordSchema.safeParse({ email: 'ana@rota.com', audience: 'hospede' }).success,
    ).toBe(true)
    expect(forgotPasswordSchema.safeParse({ email: 'ana', audience: 'hospede' }).success).toBe(
      false,
    )
  })
  it('nova senha: mínimo 8 e as duas iguais', () => {
    const base = { token: 'a'.repeat(56), audience: 'hospede' as const }
    expect(
      resetPasswordSchema.safeParse({ ...base, password: 'novasenha1', confirm: 'novasenha1' })
        .success,
    ).toBe(true)
    expect(
      resetPasswordSchema.safeParse({ ...base, password: 'curta', confirm: 'curta' }).success,
    ).toBe(false)
    const diff = resetPasswordSchema.safeParse({
      ...base,
      password: 'novasenha1',
      confirm: 'outrasenha',
    })
    expect(diff.success).toBe(false)
    if (!diff.success) expect(diff.error.issues[0]?.path).toEqual(['confirm'])
  })
  it('público desconhecido vira hóspede e cada um volta pro seu painel', () => {
    expect(parseResetAudience('xpto')).toBe('hospede')
    expect(parseResetAudience('parceiro')).toBe('parceiro')
    expect(RESET_REDIRECT.parceiro).toBe('/dashboard')
  })
})
