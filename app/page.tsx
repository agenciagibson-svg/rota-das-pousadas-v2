import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Hero } from '@/components/landing/hero'
import { Destinations } from '@/components/landing/destinations'
import { Experiences } from '@/components/landing/experiences'
import { FeaturedPousadas } from '@/components/landing/featured-pousadas'
import { SeasonalOffers } from '@/components/landing/seasonal-offers'
import { SocialProof } from '@/components/landing/social-proof'
import { Editorial } from '@/components/landing/editorial'
import { getDestinations, getExperiences, getPousadas } from '@/server/queries'

export default async function Page() {
  // Fluxo obrigatório: Server Component → Server Query → Service → Repository.
  const [destinations, experiences, pousadas] = await Promise.all([
    getDestinations(),
    getExperiences(),
    getPousadas(),
  ])

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <Destinations destinations={destinations} />
        <Experiences experiences={experiences} />
        <SeasonalOffers />
        <FeaturedPousadas pousadas={pousadas.items} />
        <SocialProof />
        <Editorial />
      </main>
      <SiteFooter />
    </div>
  )
}
