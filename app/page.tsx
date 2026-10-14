import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Hero } from '@/components/landing/hero'
import { Destinations } from '@/components/landing/destinations'
import { Experiences } from '@/components/landing/experiences'
import { FeaturedPousadas } from '@/components/landing/featured-pousadas'
import { SeasonalOffers } from '@/components/landing/seasonal-offers'
import { HowItWorks } from '@/components/landing/how-it-works'
import { SocialProof } from '@/components/landing/social-proof'
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

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader />
      <main>
        <Hero />
        <Destinations destinations={destinations} />
        <Experiences experiences={experiences} />
        <SeasonalOffers />
        <FeaturedPousadas pousadas={pousadas.items} />
        <HowItWorks />
        <SocialProof />
        <Faq />
        <Editorial />
      </main>
      <SiteFooter />
    </div>
  )
}
