import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupCep } from './cep'

afterEach(() => vi.unstubAllGlobals())

describe('lookupCep', () => {
  it('devolve o endereço do ViaCEP', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              logradouro: 'Av. Afonso Pena',
              bairro: 'Centro',
              localidade: 'Uberlândia',
              uf: 'MG',
            }),
          ),
        ),
    )
    expect(await lookupCep('38400-000')).toEqual({
      cep: '38400000',
      street: 'Av. Afonso Pena',
      district: 'Centro',
      city: 'Uberlândia',
      state: 'MG',
    })
  })
  it('CEP inexistente = null (sem consultar se o formato já é inválido)', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: true })))
    vi.stubGlobal('fetch', fetch)
    expect(await lookupCep('99999-999')).toBeNull()
    fetch.mockClear()
    expect(await lookupCep('123')).toBeNull()
    expect(await lookupCep('00000-000')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('ViaCEP fora do ar: usa a BrasilAPI', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ street: 'Rua X', neighborhood: 'B', city: 'Campinas', state: 'SP' }),
          ),
        ),
    )
    expect(await lookupCep('13010-000')).toMatchObject({ city: 'Campinas', state: 'SP' })
  })
  it('tudo fora do ar = unavailable (não bloqueia o cadastro)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await lookupCep('13010-000')).toBe('unavailable')
  })
})
