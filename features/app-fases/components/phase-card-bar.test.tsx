// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseCardBar } from './phase-card-bar'
import type { PhaseCard } from '../phase'

function mockCard(card: PhaseCard | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ card }), { status: 200 })),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

const pos: PhaseCard = {
  kind: 'pos',
  eyebrow: 'Como foi a estadia?',
  title: 'Pousada Ipê',
  cta: 'Avaliar',
  href: '/minhas-reservas/x/avaliar',
  dismissKey: 'rp_pos_x',
}

describe('cartão da fase na loja', () => {
  it('mostra o atalho para a estadia', async () => {
    mockCard({
      kind: 'estadia',
      eyebrow: 'Você está hospedado',
      title: 'Pousada Ipê',
      cta: 'Abrir sua estadia',
      href: '/estadia/x',
    })
    render(<PhaseCardBar />)
    const link = await screen.findByRole('link', { name: /Pousada Ipê/ })
    expect(link.getAttribute('href')).toBe('/estadia/x')
    expect(screen.queryByRole('button', { name: 'Dispensar' })).toBeNull()
  })

  it('sem fase, não aparece', async () => {
    mockCard(null)
    const { container } = render(<PhaseCardBar />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })

  it('pós-estadia dispensado não volta a aparecer', async () => {
    mockCard(pos)
    render(<PhaseCardBar />)
    fireEvent.click(await screen.findByRole('button', { name: 'Dispensar' }))
    expect(screen.queryByText('Pousada Ipê')).toBeNull()
    expect(localStorage.getItem('rp_pos_x')).toBe('1')

    cleanup()
    render(<PhaseCardBar />)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Pousada Ipê')).toBeNull()
  })

  it('falha na busca não quebra a loja', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    const { container } = render(<PhaseCardBar />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })
})
