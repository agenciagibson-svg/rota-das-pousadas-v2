import { describe, expect, it } from 'vitest'
import { shouldShowWholePhoto } from './photo-fit'

describe('shouldShowWholePhoto', () => {
  it('preenche quando a foto tem quase o formato do quadro', () => {
    expect(shouldShowWholePhoto(4 / 3, 4 / 3)).toBe(false)
    expect(shouldShowWholePhoto(3 / 2, 4 / 3)).toBe(false)
  })

  it('mostra inteira a foto vertical em quadro deitado', () => {
    expect(shouldShowWholePhoto(4 / 5, 4 / 3)).toBe(true)
    expect(shouldShowWholePhoto(9 / 16, 1)).toBe(true)
  })

  it('mostra inteiro o panorama em quadro em pé', () => {
    expect(shouldShowWholePhoto(3, 3 / 4)).toBe(true)
  })

  it('ignora medidas inválidas', () => {
    expect(shouldShowWholePhoto(0, 1)).toBe(false)
    expect(shouldShowWholePhoto(1, Number.NaN)).toBe(false)
  })
})
