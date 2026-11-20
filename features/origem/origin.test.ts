import { describe, expect, it } from 'vitest'
import { channelLabel, decodeOrigin, encodeOrigin, marketingLinks, originFromVisit } from './origin'

const NOW = new Date('2099-01-10T12:00:00Z')

describe('origem da visita (0106)', () => {
  it('lê UTM, clique de anúncio e a página de entrada', () => {
    const o = originFromVisit(
      'https://rotadaspousadas.com.br/pousada/x?utm_source=google&utm_medium=perfil&utm_campaign=x&gclid=abc',
      '',
      NOW,
    )
    expect(o).toEqual({
      source: 'google',
      medium: 'perfil',
      campaign: 'x',
      content: undefined,
      term: undefined,
      referrerHost: undefined,
      landingPath: '/pousada/x',
      clickId: 'gclid',
      at: NOW.toISOString(),
    })
  })

  it('sem UTM, usa o site de onde a pessoa veio', () => {
    const o = originFromVisit(
      'https://rotadaspousadas.com.br/',
      'https://l.instagram.com/?u=1',
      NOW,
    )
    expect(o?.referrerHost).toBe('l.instagram.com')
    expect(o?.source).toBeUndefined()
  })

  it('acesso direto ou navegação interna não trazem origem nova', () => {
    expect(originFromVisit('https://rotadaspousadas.com.br/pousadas', '', NOW)).toBeNull()
    expect(
      originFromVisit(
        'https://rotadaspousadas.com.br/pousadas',
        'https://rotadaspousadas.com.br/',
        NOW,
      ),
    ).toBeNull()
    expect(
      originFromVisit(
        'https://rotadaspousadas.com.br/pousadas',
        'https://www.rotadaspousadas.com.br/',
        NOW,
      ),
    ).toBeNull()
  })

  it('o cookie ida e volta mantém os campos e descarta o que não conhece', () => {
    const o = originFromVisit('https://rotadaspousadas.com.br/?utm_source=whatsapp', '', NOW)!
    expect(decodeOrigin(encodeOrigin(o))).toEqual(o)
    expect(decodeOrigin('lixo')).toBeNull()
    expect(decodeOrigin(encodeURIComponent(JSON.stringify({ at: 'x', clickId: 'outro' })))).toEqual(
      expect.objectContaining({ clickId: undefined }),
    )
  })

  it('links da pousada com a origem marcada', () => {
    const l = marketingLinks('https://rotadaspousadas.com.br/', 'pousada-x')
    expect(l.googleProfile).toBe(
      'https://rotadaspousadas.com.br/pousada/pousada-x?utm_source=google&utm_medium=perfil&utm_campaign=pousada-x',
    )
    expect(l.instagramBio).toBe(
      'https://rotadaspousadas.com.br/pousada-x?utm_source=instagram&utm_medium=bio&utm_campaign=pousada-x',
    )
    expect(originFromVisit(l.googleProfile, '', NOW)?.medium).toBe('perfil')
  })

  it('rótulo do canal; desconhecido vira sem registro', () => {
    expect(channelLabel('perfil_google')).toBe('Perfil da pousada no Google')
    expect(channelLabel(null)).toBe('Sem registro de origem')
    expect(channelLabel('inventado')).toBe('Sem registro de origem')
  })
})
