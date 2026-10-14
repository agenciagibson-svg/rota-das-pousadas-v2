import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ConciergeChat } from '@/components/concierge/concierge-chat'
import { TravelConcierge } from '@/components/concierge/travel-concierge'
import { Marker } from '@/components/brand/logo'
import { getPousadas } from '@/server/queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Concierge de viagem',
  description:
    'Monte uma rota personalizada e descubra pousadas alinhadas ao seu estilo de viagem.',
}

export default async function ConciergePage() {
  const result = await getPousadas({ pageSize: 100 })

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
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
        <div className="mx-auto max-w-4xl">
          <ConciergeChat />
        </div>
        <div className="mt-16 mb-6 max-w-2xl">
          <h2 className="text-h2 text-foreground">Prefere escolher por filtros?</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Escolha o clima da viagem, o grupo e o orçamento — as sugestões mudam na hora.
          </p>
        </div>
        <TravelConcierge pousadas={result.items} />
      </main>
      <SiteFooter />
    </div>
  )
}
