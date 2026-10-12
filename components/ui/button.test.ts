import { describe, expect, it } from 'vitest'
import { buttonVariants } from './button'

describe('buttonVariants', () => {
  it('pílulas não carregam o raio base junto (rounded-full vence sem cn externo)', () => {
    for (const size of ['lg', 'pill-sm', 'pill', 'pill-lg', 'icon-pill'] as const) {
      const classes = buttonVariants({ size }).split(' ')
      expect(classes).toContain('rounded-full')
      expect(classes).not.toContain('rounded-lg')
    }
  })

  it('className extra continua sobrepondo a variante', () => {
    const classes = buttonVariants({ size: 'pill', className: 'h-14' }).split(' ')
    expect(classes).toContain('h-14')
    expect(classes).not.toContain('h-12')
  })
})
