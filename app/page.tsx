import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Hero } from '@/components/landing/hero'
import { Destinations } from '@/components/landing/destinations'
import { Experiences } from '@/components/landing/experiences'
import { FeaturedPousadas } from '@/components/landing/featured-pousadas'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Faq } from '@/components/landing/faq'
import { Editorial } from '@/components/landing/editorial'
import { getDestinations, getExperiences, getPousadas } from '@/server/queries'

/**
 * Renderização por requisição, explícita. Com o Supabase configurado a página
 * já era dinâmica (as consultas leem cookies); sem ele (dados de exemplo) o
 * Next a pré-renderizava no build, sem o nonce que a CSP de `proxy.ts` exige.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  // Fluxo obrigatório: Server Component → Server Query → Service → Repository.
  const [destinations, experiences, pousadas] = await Promise.all([
    getDestinations(),
    getExperiences(),
    getPousadas(),
  ])

  // Ordem (redesign out/2026): as pousadas logo depois do hero, para o
  // caminho até "Reservar agora" começar cedo; inspiração depois.
  //
  // Fora da home desde 19/11/2026, até existirem dados reais para mostrar:
  // "Ofertas da estação" (preços inventados por destino) e "Prova social"
  // (depoimentos e números de exemplo). Os componentes continuam em
  // components/landing/. A seção de pousadas só aparece com pousada publicada.
  return (
    <div className="bg-background min-h-screen">
      <SiteHeader />
      <main id="conteudo" tabIndex={-1}>
        <Hero featured={pousadas.items[0]} />
        {pousadas.items.length > 0 && <FeaturedPousadas pousadas={pousadas.items} />}
        <Experiences experiences={experiences} />
        <Destinations destinations={destinations} />
        <HowItWorks />
        <Faq />
        <Editorial />
      </main>
      <SiteFooter />
    </div>
  )
}
