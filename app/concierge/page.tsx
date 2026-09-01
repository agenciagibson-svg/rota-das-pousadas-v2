import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { TravelConcierge } from '@/components/concierge/travel-concierge'
import { getPousadas } from '@/server/queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Concierge de viagem | Rota das Pousadas',
  description: 'Monte uma rota personalizada e descubra pousadas alinhadas ao seu estilo de viagem.',
}

export default async function ConciergePage() {
  const result = await getPousadas({ pageSize: 100 })

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader forceSolid />
      <main className="mx-auto max-w-7xl px-5 pb-20 pt-28 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Concierge de viagem
          </span>
          <h1 className="mt-3 text-balance font-serif text-4xl font-semibold leading-tight text-foreground sm:text-6xl">
            Conte como quer viajar. A rota aparece na hora.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Uma camada inteligente para transformar intencao em pousadas recomendadas, datas
            sugeridas e uma busca pronta para reservar.
          </p>
        </div>
        <TravelConcierge pousadas={result.items} />
      </main>
      <SiteFooter />
    </div>
  )
}
