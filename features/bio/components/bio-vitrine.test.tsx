import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BioHero } from './bio-hero'
import { BioHighlights } from './bio-highlights'
import { BioStickyCta } from './bio-sticky-cta'
import { BioTrust } from './bio-trust'

describe('vitrine da bio', () => {
  it('topo mostra as fotos para deslizar, nome, cidade e nota', () => {
    const html = renderToStaticMarkup(
      <BioHero
        name="Pousada Teste"
        city="Araxá"
        state="MG"
        photos={['/a.jpg', '/b.jpg', '/c.jpg']}
        rating={4.9}
        reviews={12}
      />,
    )
    expect(html).toContain('Pousada Teste')
    expect(html).toContain('Araxá, MG')
    expect(html).toContain('3 fotos · deslize')
    expect(html).toContain('4,9')
    expect(html).toContain('snap-x')
  })

  it('sem avaliação não mostra nota zerada; com uma foto não pede para deslizar', () => {
    const html = renderToStaticMarkup(
      <BioHero name="P" city="C" state="MG" photos={['/a.jpg']} rating={0} reviews={0} />,
    )
    expect(html).not.toContain('avaliaç')
    expect(html).not.toContain('deslize')
  })

  it('barra fixa leva às datas sem JavaScript', () => {
    const html = renderToStaticMarkup(<BioStickyCta priceFrom={420} />)
    expect(html).toContain('href="#datas"')
    expect(html).toContain('a partir de')
  })

  it('garantias e destaques', () => {
    expect(renderToStaticMarkup(<BioTrust />)).toContain('Sem taxa extra')
    const html = renderToStaticMarkup(
      <BioHighlights
        slug="p"
        tags={['Lareira', 'Café da manhã']}
        reviews={[{ id: '1', rating: 5, text: 'Lugar lindo', createdAt: '2026-10-01T12:00:00Z' }]}
      />,
    )
    expect(html).toContain('Lareira')
    expect(html).toContain('Lugar lindo')
    expect(html).toContain('/pousada/p?origem=link_bio')
  })
})
