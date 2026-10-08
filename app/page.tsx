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

export default async function Page() {
  // Fluxo obrigatório: Server Component → Server Query → Service → Repository.
  const [destinations, experiences, pousadas] = await Promise.all([
    getDestinations(),
    getExperiences(),
    getPousadas(),
  ])

  // Ordem (redesign out/2026): as pousadas logo depois do hero, para o
  // caminho até "Reservar agora" começar cedo; inspiração depois.
  return (
    <div className="bg-background min-h-screen">
      <SiteHeader />
      <main>
        <Hero featured={pousadas.items[0]} />
        <FeaturedPousadas pousadas={pousadas.items} />
        <Experiences experiences={experiences} />
        <Destinations destinations={destinations} />
        <SeasonalOffers />
        <HowItWorks />
        <SocialProof />
        <Faq />
        <Editorial />
      </main>
      <SiteFooter />
    </div>
  )
}
