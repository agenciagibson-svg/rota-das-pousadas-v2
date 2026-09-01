import { describe, it, expect } from 'vitest'
import { loginSchema, signupSchema } from './schemas'

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
