import Link from 'next/link'
import { ArrowUpRight, Quote, Star } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { cn } from '@/lib/utils'

const testimonials = [
  {
    name: 'Marina Alves',
    route: 'Monte Verde, MG',
    text: 'Eu entrei sem saber para onde ir e saí com uma pousada que parecia escolhida por alguém que me conhecia.',
    trip: 'fim de semana romântico',
  },
  {
    name: 'Rafael e Bianca',
    route: 'Capitólio, MG',
    text: 'A busca por estilo de viagem ajudou mais que qualquer lista comum. Encontramos cachoeiras, vista e descanso no mesmo lugar.',
    trip: 'natureza e piscina',
  },
  {
    name: 'Carla Menezes',
    route: 'Serra da Canastra, MG',
    text: 'Gostei porque a experiência não começa na reserva. Começa na inspiração, nas rotas e nas pousadas com história.',
    trip: 'rota de outono',
  },
]

const trustMarks = [
  { label: 'Pousadas com curadoria', value: '3.400+' },
  { label: 'Destinos brasileiros', value: '180' },
  { label: 'Média de avaliação', value: '4.9' },
  { label: 'Hóspedes voltam', value: '96%' },
]

function Stars() {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className="fill-ipe text-ipe size-4" />
      ))}
    </div>
  )
}

export function SocialProof() {
  return (
    <section className="py-16 lg:py-24">
      <Container>
        <Reveal>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end lg:gap-16">
            <SectionHeading eyebrow="Prova social" title="Viajantes que encontraram sua rota" />
            <p className="text-muted-foreground text-base leading-relaxed text-pretty">
              Antes de reservar, o visitante precisa sentir confiança. Aqui mostramos sinais claros
              de curadoria, avaliação e experiência, reforçando que a Rota das Pousadas não é apenas
              uma lista: é uma forma mais humana de escolher onde ficar.
            </p>
          </div>
        </Reveal>

        {/* Números numa faixa só, separados por fios, sem um ícone por número. */}
        <Reveal>
          <Card radius="3xl" border={false} className="mt-10 grid grid-cols-2 lg:grid-cols-4">
            {trustMarks.map((mark, index) => (
              <div
                key={mark.label}
                className={cn(
                  'border-border flex flex-col gap-1 p-5 lg:border-b-0 lg:p-8',
                  index % 2 === 0 && 'border-r',
                  index < 2 && 'border-b',
                  index === 1 && 'lg:border-r',
                )}
              >
                <span className="text-muted-foreground text-xs font-medium">confiança</span>
                <span className="text-display-l text-foreground mt-2 tabular-nums">
                  {mark.value}
                </span>
                <span className="text-muted-foreground text-sm">{mark.label}</span>
              </div>
            ))}
          </Card>
        </Reveal>

        <Reveal>
          <ul className="-mx-5 mt-6 flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-4 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">
            {testimonials.map((item) => (
              <li key={item.name} className="w-[85%] shrink-0 snap-start sm:w-[60%] lg:w-auto">
                <Card radius="3xl" border={false} className="flex h-full flex-col p-6 lg:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <Quote className="text-pedra size-7" />
                    <Stars />
                  </div>
                  <p className="text-foreground mt-5 flex-1 text-lg leading-relaxed text-pretty">
                    {item.text}
                  </p>
                  <div className="border-border mt-6 border-t pt-4">
                    <div className="text-foreground font-semibold">{item.name}</div>
                    <div className="text-muted-foreground mt-1 text-sm">{item.route}</div>
                    <Badge variant="secondary" size="md" className="mt-3">
                      {item.trip}
                    </Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal>
          <div className="bg-breu text-neblina mt-6 flex flex-col gap-6 rounded-3xl p-6 md:flex-row md:items-center md:justify-between lg:p-10">
            <div>
              <h3 className="text-h2">Pronto para encontrar uma pousada com mais contexto?</h3>
              <p className="text-liquen mt-2 text-base">
                Busque por cidade, clima ou estilo de viagem e abra uma rota com datas prontas.
              </p>
            </div>
            <Link
              href="/pousadas"
              className={cn(buttonVariants({ variant: 'accent', size: 'pill-lg' }), 'w-fit')}
            >
              Ver pousadas
              <ArrowUpRight className="size-5" />
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
