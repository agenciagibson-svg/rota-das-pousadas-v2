import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const stats = [
  { value: '3.400+', label: 'pousadas curadas' },
  { value: '180', label: 'destinos no Brasil' },
  { value: '4.9', label: 'avaliação média' },
  { value: '96%', label: 'hóspedes voltam' },
]

export function Editorial() {
  return (
    <>
      {/* Stats band */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 py-14 lg:grid-cols-4 lg:px-8">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div className="text-center lg:text-left">
                <div className="font-serif text-4xl font-semibold lg:text-5xl">{s.value}</div>
                <div className="mt-2 text-sm text-primary-foreground/70">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Editorial split — Home viva story */}
      <section id="editorial" className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
        <Reveal>
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              A home que muda com você
            </span>
            <h2 className="mt-3 text-balance font-serif text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
              Uma plataforma viva, como as estações
            </h2>
            <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
              A Rota das Pousadas se transforma com o clima, o calendário e as datas especiais. No
              inverno, chalés e lareiras. No verão, praias e cachoeiras. Na primavera, o verde
              renascido. A cada visita, uma nova inspiração para a sua próxima viagem.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Recomendações que acompanham a estação do ano',
                'Roteiros sugeridos para feriados prolongados',
                'Destaques para o Dia dos Namorados e férias em família',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="#destinos"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-105"
            >
              Descobrir a estação de agora
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem]">
            <Image
              src="/images/experience.png"
              alt="Casal relaxando em ofurô com vista para o vale ao amanhecer"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </Reveal>
      </section>

      {/* Owner CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8 lg:pb-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-stone-deep px-6 py-14 text-center lg:px-16 lg:py-20">
            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="text-balance font-serif text-3xl font-semibold leading-tight text-linen sm:text-4xl">
                Tem uma pousada? Conte sua história para o Brasil inteiro.
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-linen/70">
                Junte-se ao maior ecossistema digital de pousadas do país. Gestão de reservas,
                marketing com IA e um público apaixonado por viajar.
              </p>
              <div className="mt-8 flex items-center justify-center">
                <Link
                  href="/parceiros/login"
                  className="rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground transition-all hover:brightness-105"
                >
                  Anunciar gratuitamente
                </Link>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 size-72 rounded-full bg-accent/20 blur-3xl" />
          </div>
        </Reveal>
      </section>
    </>
  )
}
