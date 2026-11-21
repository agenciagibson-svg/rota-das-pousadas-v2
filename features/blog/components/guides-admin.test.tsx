// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ action: vi.fn(), refresh: vi.fn() }))
vi.mock('../actions', () => ({ setGuideHiddenAction: mocks.action }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

import { GuidesAdmin } from './guides-admin'
import type { GuideRow } from '../services/guides.service'

const row = (over: Partial<GuideRow>): GuideRow => ({
  slug: 'guia-a',
  title: 'Guia A',
  place: 'Lugar',
  publishedAt: '2026-11-20',
  state: 'publicado',
  hiddenReason: '',
  tips: { pending: 0, approved: 2 },
  ...over,
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('guias no painel', () => {
  it('mostra a situação de cada guia e o link para o site', () => {
    render(
      <GuidesAdmin
        guides={[
          row({}),
          row({ slug: 'guia-b', title: 'Guia B', state: 'fora_do_ar', hiddenReason: 'Fotos' }),
          row({
            slug: 'guia-c',
            title: 'Guia C',
            state: 'rascunho',
            tips: { pending: 1, approved: 0 },
          }),
        ]}
      />,
    )
    expect(screen.getByText('No ar')).toBeTruthy()
    expect(screen.getByText('Fora do ar')).toBeTruthy()
    expect(screen.getByText('Motivo: Fotos')).toBeTruthy()
    expect(screen.getByText(/1 para revisar/)).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /Abrir/ })).toHaveLength(1)
  })

  it('tirar do ar pede confirmação e manda o motivo', async () => {
    mocks.action.mockResolvedValue({ ok: true, data: { hidden: true } })
    render(<GuidesAdmin guides={[row({})]} />)
    fireEvent.click(screen.getByRole('button', { name: /Tirar do ar/ }))
    fireEvent.change(screen.getByPlaceholderText(/revisar as fotos/), {
      target: { value: 'Atualizar preços' },
    })
    const confirm = screen.getAllByRole('button', { name: /Tirar do ar/ }).at(-1)!
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(mocks.action).toHaveBeenCalledWith({
        slug: 'guia-a',
        hidden: true,
        reason: 'Atualizar preços',
      }),
    )
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
  })

  it('voltar ao ar é direto', async () => {
    mocks.action.mockResolvedValue({ ok: true, data: { hidden: false } })
    render(<GuidesAdmin guides={[row({ state: 'fora_do_ar' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /Voltar ao ar/ }))
    await waitFor(() =>
      expect(mocks.action).toHaveBeenCalledWith({ slug: 'guia-a', hidden: false, reason: '' }),
    )
  })
})
