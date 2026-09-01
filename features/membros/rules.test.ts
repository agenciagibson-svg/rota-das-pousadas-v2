import { describe, it, expect } from 'vitest'
import { wouldLeaveNoActiveOwner, isSelfAction } from './rules'

describe('wouldLeaveNoActiveOwner', () => {
  it('bloqueia remover o único proprietário ativo', () => {
    expect(wouldLeaveNoActiveOwner('proprietario', 1)).toBe(true)
  })

  it('permite remover um proprietário quando há outros ativos', () => {
    expect(wouldLeaveNoActiveOwner('proprietario', 2)).toBe(false)
  })

  it('não se aplica a papéis que não são proprietário', () => {
    expect(wouldLeaveNoActiveOwner('admin_pousada', 1)).toBe(false)
    expect(wouldLeaveNoActiveOwner('recepcionista', 0)).toBe(false)
  })

  it('trata contagem zero como bloqueio (estado inconsistente, nunca deve piorar)', () => {
    expect(wouldLeaveNoActiveOwner('proprietario', 0)).toBe(true)
  })
})

describe('isSelfAction', () => {
  it('detecta quando o ator mira o próprio vínculo', () => {
    expect(isSelfAction('user-1', 'user-1')).toBe(true)
    expect(isSelfAction('user-1', 'user-2')).toBe(false)
  })
})
