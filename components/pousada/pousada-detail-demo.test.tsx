// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pousada } from '@/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/demo/x',
  useSearchParams: () => new URLSearchParams(),
}))

// A galeria e o mapa observam a rolagem; o jsdom não tem IntersectionObserver.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
vi.stubGlobal('IntersectionObserver', NoopObserver)

import { PousadaDetail } from './pousada-detail'

afterEach(cleanup)

const pousada = {
  id: 'p1',
  slug: 'mirante',
  name: 'Mirante das Araucárias',
  city: 'Gonçalves',
  state: 'MG',
  image: '',
  gallery: [],
  rating: 0,
  reviews: 0,
  pricePerNight: 350,
  tags: ['Lareira'],
  description: 'Chalés entre araucárias.',
  instagram: null,
  address: null,
  cep: null,
  checkinTime: null,
  checkoutTime: null,
  cancellationPolicy: null,
  houseRules: null,
  whatsapp: null,
  contactPhone: null,
  coordinates: null,
} as unknown as Pousada

const rooms = [
  {
    id: 'r1',
    name: 'Chalé Mirante',
    description: '',
    capacity: 2,
    nightly: 590,
    gallery: [],
    stayTotal: null,
    minNights: 1,
  },
  {
    id: 'r2',
    name: 'Suíte Jardim',
    description: '',
    capacity: 2,
    nightly: 430,
    gallery: [],
    stayTotal: null,
    minNights: 1,
  },
]

describe('PousadaDetail em modo demonstração (0101)', () => {
  it('troca a reserva pela explicação e não mostra favoritar nem compartilhar', () => {
    render(
      <PousadaDetail
        pousada={pousada}
        room={null}
        rooms={rooms}
        reviews={[]}
        favorite={false}
        isLoggedIn={false}
        demo
      />,
    )
    expect(screen.getByText('Aqui o hóspede reserva direto')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Quero a minha pousada assim' }).getAttribute('href'),
    ).toBe('/anunciar')
    expect(screen.queryByRole('button', { name: /favorit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /compartilh/i })).toBeNull()
    // "a partir de" usa a acomodação mais barata.
    expect(document.getElementById('reservar')?.textContent).toMatch(/a partir de\s*R\$\s*430/)
  })

  it('sem avaliação real não mostra "0.0 (0 avaliações)"', () => {
    render(
      <PousadaDetail
        pousada={pousada}
        room={null}
        rooms={rooms}
        reviews={[]}
        favorite={false}
        isLoggedIn={false}
        demo
      />,
    )
    expect(screen.getByText('Nova na Rota')).toBeTruthy()
    expect(screen.queryByText(/0 avaliações/)).toBeNull()
    expect(screen.queryByText('0.0')).toBeNull()
  })
})
