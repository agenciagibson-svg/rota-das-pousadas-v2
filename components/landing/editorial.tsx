import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Marker } from '@/components/brand/logo'
import { Reveal } from '@/components/reveal'
import { buttonVariants } from '@/components/ui/button'
import { Container, Section } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { cn } from '@/lib/utils'

const stats = [
  { value: '3.400+', label: 'pousadas curadas' },
  { value: '180', label: 'destinos no Brasil' },
  { value: '4.9', label: 'avaliação média' },
  { value: '96%', label: 'hóspedes voltam' },
]

const seasonalPoints = [
  'Recomendações que acompanham a estação do ano',
  'Roteiros sugeridos para feriados prolongados',
  'Destaques para o Dia dos Namorados e férias em família',
]

export function Editorial() {
  return (
    <>
      {/* Faixa de números em Breu, número leve e rótulo em Líquen. */}
      <section className="bg-breu text-neblina">
        <Container className="grid grid-cols-2 gap-8 py-12 lg:grid-cols-4 lg:py-16">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div className="text-display-l font-light tabular-nums">{s.value}</div>
              <div className="text-liquen mt-2 text-sm">{s.label}</div>
            </Reveal>
          ))}
        </Container>
      </section>

      {/* A home viva: texto ao lado de uma foto vertical grande. */}
      <Section
        id="editorial"
        className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24"
      >
        <Reveal>
          <SectionHeading
            eyebrow="A home que muda com você"
            title="Uma plataforma viva, como as estações"
          />
          <p className="text-muted-foreground mt-5 text-base leading-relaxed text-pretty">
            A Rota das Pousadas se transforma com o clima, o calendário e as datas especiais. No
            inverno, chalés e lareiras. No verão, praias e cachoeiras. Na primavera, o verde
            renascido. A cada visita, uma nova inspiração para a sua próxima viagem.
          </p>
          <ul className="mt-6 space-y-3">
            {seasonalPoints.map((item) => (
              <li key={item} className="text-foreground flex items-start gap-3 text-base">
                <Marker className="text-foreground mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
          <Link href="#destinos" className={cn(buttonVariants({ size: 'pill-lg' }), 'mt-8 w-fit')}>
            Descobrir a estação de agora
            <ArrowRight className="size-5" />
          </Link>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl">
            <Image
              src="/images/experience.png"
              alt="Casal relaxando em ofurô com vista para o vale ao amanhecer"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </Reveal>
      </Section>

      {/* Chamada para o dono de pousada: texto no Breu, foto do lado. */}
      <Section className="pb-16 lg:pb-24">
        <Reveal>
          <div className="bg-breu text-neblina grid overflow-hidden rounded-3xl lg:grid-cols-2">
            <div className="relative aspect-[16/10] lg:order-2 lg:aspect-auto">
              <Image
                src="/images/gallery-3.png"
                alt="Café da manhã servido na varanda de uma pousada com vista para as montanhas"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-center gap-4 p-6 sm:p-10 lg:p-16">
              <h2 className="text-h1">
                Tem uma pousada? Conte sua história para o Brasil inteiro.
              </h2>
              <p className="text-liquen text-base leading-relaxed text-pretty">
                Junte-se ao maior ecossistema digital de pousadas do país. Gestão de reservas,
                marketing com IA e um público apaixonado por viajar.
              </p>
              <Link
                href="/parceiros/login"
                className={cn(
                  buttonVariants({ variant: 'inverse', size: 'pill-lg' }),
                  'mt-4 w-fit',
                )}
              >
                Anunciar gratuitamente
              </Link>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  )
}
