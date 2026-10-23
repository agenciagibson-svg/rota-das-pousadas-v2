import { describe, expect, it } from 'vitest'
import { deleteAccountSchema, emailsMatch } from './account-deletion'

describe('deleteAccountSchema', () => {
  it('aceita um e-mail e tira os espaços das pontas', () => {
    const r = deleteAccountSchema.safeParse({ confirmEmail: '  ana@example.test ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.confirmEmail).toBe('ana@example.test')
  })

  it('pede o e-mail quando vazio', () => {
    const r = deleteAccountSchema.safeParse({ confirmEmail: '   ' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toBe('Digite seu e-mail para confirmar.')
  })

  it('recusa texto que não é e-mail', () => {
    expect(deleteAccountSchema.safeParse({ confirmEmail: 'excluir' }).success).toBe(false)
  })

  it('recusa sem o campo', () => {
    expect(deleteAccountSchema.safeParse({}).success).toBe(false)
  })
})

describe('emailsMatch', () => {
  it('ignora maiúsculas e espaços', () => {
    expect(emailsMatch(' Ana@Example.TEST ', 'ana@example.test')).toBe(true)
  })

  it('e-mail diferente não confirma', () => {
    expect(emailsMatch('outra@example.test', 'ana@example.test')).toBe(false)
  })

  it('conta sem e-mail nunca confirma', () => {
    expect(emailsMatch('', '')).toBe(false)
  })
})
