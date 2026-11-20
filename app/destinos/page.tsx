import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/section-heading'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getCityDestinations, getDestinations } from '@/server/queries'
import { cityPhoto } from '@/features/destinos'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const destinations = await getCityDestinations()
  return {
    title: 'Destinos com pousadas para reservar direto',
    description:
      'Escolha a cidade e veja as pousadas com reserva direta, sem intermediário. Pague com Pix ou cartão.',
    alternates: { canonical: '/destinos' },
    // Lista vazia não vai para o Google; entra assim que houver pousada publicada.
    ...(destinations.length === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function DestinosPage() {
  const [destinations, curated] = await Promise.all([getCityDestinations(), getDestinations()])
  const states = [...new Set(destinations.map((d) => d.state))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        <SectionHeading
          as="h1"
          eyebrow="Destinos"
          title="Pousadas por cidade"
          description="Cada cidade reúne as pousadas publicadas na Rota. Abra a cidade para ver as pousadas, os preços e reservar direto."
        />

        {destinations.length === 0 ? (
          <Card radius="3xl" border={false} className="mt-10 p-10 text-center">
            <h2 className="text-h2 text-foreground">Os primeiros destinos estão chegando</h2>
            <p className="text-muted-foreground mt-2 text-base">
              Assim que as pousadas forem publicadas, as cidades aparecem aqui.
            </p>
            <Link href="/pousadas" className={cn(buttonVariants({ size: 'pill' }), 'mt-6')}>
              Ver pousadas
            </Link>
          </Card>
        ) : (
          states.map((state) => (
            <section key={state} aria-labelledby={`uf-${state}`} className="mt-12">
              <h2 id={`uf-${state}`} className="text-h3 text-foreground">
                {state}
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {destinations
                  .filter((d) => d.state === state)
                  .map((d) => (
                    <li key={d.slug}>
                      <Link
                        href={`/destinos/${d.slug}`}
                        className="group relative block aspect-[4/3] overflow-hidden rounded-3xl"
                      >
                        <Image
                          src={cityPhoto(d, curated) ?? (d.image || '/placeholder.svg')}
                          alt={`Pousadas em ${d.city}, ${d.state}`}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
                        />
                        <div className="from-breu/85 via-breu/10 absolute inset-0 bg-gradient-to-t to-transparent" />
                        <div className="text-primary-foreground absolute inset-x-0 bottom-0 p-4">
                          <h3 className="text-h3">{d.city}</h3>
                          <p className="text-primary-foreground/85 mt-1 text-sm">
                            {d.pousadas.length === 1
                              ? '1 pousada'
                              : `${d.pousadas.length} pousadas`}
                            {d.priceFrom > 0 ? ` · a partir de ${formatPrice(d.priceFrom)}` : ''}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
