import { describe, expect, it } from 'vitest'
import { maskRecipient } from './mailer'

describe('maskRecipient', () => {
  it('mostra só o domínio', () => {
    expect(maskRecipient('ana.souza@gmail.com')).toBe('***@gmail.com')
    expect(maskRecipient('sem-arroba')).toBe('***')
  })
})
