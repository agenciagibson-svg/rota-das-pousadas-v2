import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BedDouble, Compass, Sparkles, TrendingUp, Users2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'primary' | 'ocean' | 'gold' | 'accent'

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary/25 text-primary',
  ocean: 'bg-ocean/25 text-ocean',
  gold: 'bg-gold/25 text-gold',
  accent: 'bg-accent/25 text-accent',
}

const perks = [
  {
    icon: Wallet,
    tone: 'primary' as Tone,
    title: 'Pagamento com split automático',
    text: 'O hóspede paga, você recebe direto na sua conta.',
  },
  {
    icon: BedDouble,
    tone: 'ocean' as Tone,
    title: 'Reservas e acomodações num só lugar',
    text: 'Calendário, bloqueios e categorias sempre sincronizados.',
  },
  {
    icon: Users2,
    tone: 'gold' as Tone,
    title: 'Equipe com papéis definidos',
    text: 'Recepção, governança e financeiro, cada um com o acesso certo.',
  },
  {
    icon: TrendingUp,
    tone: 'accent' as Tone,
    title: 'Métricas que importam',
    text: 'Ocupação, receita e avaliações num painel só.',
  },
]

const stats = [
  { value: '3.400+', label: 'pousadas na plataforma' },
  { value: '4.9', label: 'avaliação média dos hóspedes' },
]

function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex w-fit items-center gap-3">
      <span className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full">
        <Compass className="size-7" />
      </span>
      <span
        className={cn('font-serif text-2xl font-semibold', dark ? 'text-foreground' : 'text-linen')}
      >
        Rota das Pousadas
      </span>
    </Link>
  )
}

/**
 * Layout de login do parceiro — ocupa a viewport inteira, de ponta a ponta,
 * dividido em duas metades no desktop: vitrine com foto real de pousada
 * (esse painel é o slot pensado pra futuramente hospedar patrocínio de
 * fornecedores de produtos/serviços pra pousadas) e o formulário. No
 * celular vira uma coluna só, com o formulário preenchendo a tela.
 */
export function PartnerLoginShowcase({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:h-screen lg:grid-cols-2">
      <div className="bg-stone-deep relative hidden overflow-hidden lg:block">
        <Image
          src="/images/pousada-1.png"
          alt="Pousada parceira da Rota das Pousadas"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="from-stone-deep via-stone-deep/75 absolute inset-0 bg-gradient-to-t from-15% via-55% to-transparent" />

        <div className="absolute top-10 left-10 z-10 xl:top-14 xl:left-14">
          <BrandMark />
        </div>

        <div className="text-linen absolute inset-x-0 bottom-0 z-10 p-10 xl:p-14">
          <span className="text-gold inline-flex items-center gap-2 text-sm font-semibold tracking-[0.2em] uppercase">
            <Sparkles className="size-4" />
            Painel do parceiro
          </span>
          <h1 className="mt-4 font-serif text-4xl leading-[1.1] font-semibold text-balance xl:text-5xl">
            Sua pousada, sob controle total.
          </h1>
          <p className="text-linen/80 mt-5 max-w-lg text-lg leading-relaxed text-pretty">
            Reservas, hóspedes, financeiro e equipe — tudo num painel só, pensado pra quem
            administra uma pousada de verdade.
          </p>

          <div className="mt-9 grid grid-cols-2 gap-x-8 gap-y-6">
            {perks.map((perk) => (
              <div key={perk.title} className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full',
                    toneClasses[perk.tone],
                  )}
                >
                  <perk.icon className="size-5" />
                </span>
                <div>
                  <p className="text-base leading-snug font-semibold">{perk.title}</p>
                  <p className="text-linen/70 mt-1 text-sm leading-relaxed">{perk.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-linen/15 mt-9 flex gap-10 border-t pt-7">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="font-serif text-4xl font-semibold">{stat.value}</div>
                <div className="text-linen/65 mt-1 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-secondary/40 lg:bg-card lg:border-border flex flex-col justify-center border-t px-6 py-12 sm:px-12 lg:border-t-0 lg:border-l lg:px-16 xl:px-20">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-12 flex justify-center lg:justify-start">
            <BrandMark dark />
          </div>
          <h1 className="text-foreground font-serif text-4xl font-semibold">{title}</h1>
          <p className="text-muted-foreground mt-3 text-lg leading-relaxed">{subtitle}</p>
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </div>
  )
}
