// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { Destination } from '@/types'

vi.mock('@/components/reveal', () => ({
  Reveal: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

import { Destinations } from './destinations'

afterEach(() => cleanup())

// Dados sintéticos.
const base = {
  image: '/images/exemplo.png',
  rating: 4.9,
  priceFrom: 340,
  seasons: [],
} as unknown as Destination

const semPousada = {
  ...base,
  slug: 'serra-exemplo',
  name: 'Serra de Exemplo',
  state: 'MG',
  pousadas: 0,
}
const comPousadas = {
  ...base,
  slug: 'vale-exemplo',
  name: 'Vale de Exemplo',
  state: 'GO',
  pousadas: 3,
}
const comUma = {
  ...base,
  slug: 'praia-exemplo',
  name: 'Praia de Exemplo',
  state: 'BA',
  pousadas: 1,
}

describe('Destinations', () => {
  it('destino sem pousada publicada não mostra nota, preço nem "0 pousadas"', () => {
    render(<Destinations destinations={[semPousada]} />)
    const card = screen.getByRole('link', { name: /Serra de Exemplo/ })
    expect(card.textContent).not.toMatch(/4[.,]9/)
    expect(card.textContent).not.toMatch(/A partir de/)
    expect(card.textContent).not.toMatch(/0 pousadas/)
    expect(card.textContent).toContain('MG')
  })

  it('destino com pousadas mostra a contagem, a nota e o preço', () => {
    render(<Destinations destinations={[comPousadas, comUma]} />)
    const vale = screen.getByRole('link', { name: /Vale de Exemplo/ })
    expect(vale.textContent).toContain('GO · 3 pousadas')
    expect(vale.textContent).toMatch(/4[.,]9/)
    expect(vale.textContent).toMatch(/A partir de/)
    expect(screen.getByRole('link', { name: /Praia de Exemplo/ }).textContent).toContain(
      'BA · 1 pousada',
    )
  })

  it('o card leva para a busca do próprio destino, nunca para uma pousada fixa', () => {
    render(<Destinations destinations={[semPousada, comPousadas]} />)
    expect(screen.getByRole('link', { name: /Serra de Exemplo/ }).getAttribute('href')).toBe(
      '/pousadas?busca=Serra%20de%20Exemplo',
    )
    for (const link of screen.getAllByRole('link'))
      expect(link.getAttribute('href')).not.toContain('refugio-das-nuvens')
  })
})
