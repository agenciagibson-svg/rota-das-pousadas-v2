import Link from 'next/link'
import { ArrowUpRight, BadgeCheck, Heart, Quote, ShieldCheck, Star, Users } from 'lucide-react'
import { Reveal } from '@/components/reveal'

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
  { label: 'Pousadas com curadoria', value: '3.400+', icon: BadgeCheck },
  { label: 'Destinos brasileiros', value: '180', icon: ShieldCheck },
  { label: 'Média de avaliação', value: '4.9', icon: Star },
  { label: 'Hóspedes voltam', value: '96%', icon: Heart },
]

function Stars() {
  return (
    <div className="flex items-center gap-1 text-gold">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className="size-4 fill-gold" />
      ))}
    </div>
  )
}

export function SocialProof() {
  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.4fr] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                <Users className="size-4" />
                Prova social
              </span>
              <h2 className="mt-3 text-balance font-serif text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
                Viajantes que encontraram sua rota
              </h2>
            </div>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              Antes de reservar, o visitante precisa sentir confiança. Aqui mostramos sinais claros de
              curadoria, avaliação e experiência, reforçando que a Rota das Pousadas não é apenas uma
              lista: é uma forma mais humana de escolher onde ficar.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {trustMarks.map((mark, index) => {
            const Icon = mark.icon
            return (
              <Reveal key={mark.label} delay={index * 0.06}>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <Icon className="size-5 text-primary" />
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                      confiança
                    </span>
                  </div>
                  <div className="mt-5 font-serif text-4xl font-semibold text-foreground">{mark.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{mark.label}</div>
                </div>
              </Reveal>
            )
          })}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {testimonials.map((item, index) => (
            <Reveal key={item.name} delay={index * 0.08}>
              <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <Quote className="size-7 text-primary/35" />
                  <Stars />
                </div>
                <p className="mt-5 flex-1 text-pretty text-base leading-relaxed text-foreground">
                  {item.text}
                </p>
                <div className="mt-6 border-t border-border pt-4">
                  <div className="font-semibold text-foreground">{item.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.route}</div>
                  <span className="mt-3 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                    {item.trip}
                  </span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-stone-deep p-6 text-linen shadow-floating md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-serif text-2xl font-semibold">Pronto para encontrar uma pousada com mais contexto?</h3>
              <p className="mt-2 text-sm text-linen/65">
                Busque por cidade, clima ou estilo de viagem e abra uma rota com datas prontas.
              </p>
            </div>
            <Link
              href="/pousadas"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-linen px-5 py-3 text-sm font-semibold text-stone-deep transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Ver pousadas
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
