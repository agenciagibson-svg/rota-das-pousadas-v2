import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  // As classes da escala tipográfica (styles/typography.css) são tamanhos de
  // fonte, não cores: combinadas com uma cor de texto, as duas ficam.
  it('mantém a classe da escala tipográfica junto da cor do texto', () => {
    expect(cn('text-h1 mt-3', 'text-foreground')).toBe('text-h1 mt-3 text-foreground')
    expect(cn('text-overline', 'text-liquen')).toBe('text-overline text-liquen')
    expect(cn('text-display-xl', 'text-primary-foreground')).toBe(
      'text-display-xl text-primary-foreground',
    )
  })

  it('a última classe da escala vence a anterior, como qualquer tamanho', () => {
    expect(cn('text-h3', 'text-h1')).toBe('text-h1')
    expect(cn('text-sm', 'text-h2')).toBe('text-h2')
  })
})
