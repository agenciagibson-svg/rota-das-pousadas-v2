import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { TravelConcierge } from '@/components/concierge/travel-concierge'
import { Marker } from '@/components/brand/logo'
import { getPousadas } from '@/server/queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Concierge de viagem | Rota das Pousadas',
  description:
    'Monte uma rota personalizada e descubra pousadas alinhadas ao seu estilo de viagem.',
}

export default async function ConciergePage() {
  const result = await getPousadas({ pageSize: 100 })

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <span className="text-overline inline-flex items-center gap-2">
            <Marker className="text-foreground" />
            Concierge de viagem
          </span>
          <h1 className="text-display-l text-foreground mt-3">
            <span className="block">Conte como quer viajar.</span>
            <span className="block font-light">A rota aparece na hora.</span>
          </h1>
          <p className="text-body-l text-muted-foreground mt-4 text-pretty">
            Uma camada inteligente para transformar intenção em pousadas recomendadas, datas
            sugeridas e uma busca pronta para reservar.
          </p>
        </div>
        <TravelConcierge pousadas={result.items} />
      </main>
      <SiteFooter />
    </div>
  )
}
