import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BedDouble, Sparkles, TrendingUp, Users2, Wallet } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { cn } from '@/lib/utils'

const perks = [
  {
    icon: Wallet,
    title: 'Pagamento com split automático',
    text: 'O hóspede paga, você recebe direto na sua conta.',
  },
  {
    icon: BedDouble,
    title: 'Reservas e acomodações num só lugar',
    text: 'Calendário, bloqueios e categorias sempre sincronizados.',
  },
  {
    icon: Users2,
    title: 'Equipe com papéis definidos',
    text: 'Recepção, governança e financeiro, cada um com o acesso certo.',
  },
  {
    icon: TrendingUp,
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
    <Link
      href="/"
      aria-label="Rota das Pousadas, página inicial"
      className={cn('flex w-fit', dark ? 'text-foreground' : 'text-neblina')}
    >
      <Logo className="h-7" />
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
    <div className="bg-background grid min-h-screen lg:h-screen lg:grid-cols-2">
      <div className="bg-breu relative m-3 hidden overflow-hidden rounded-3xl lg:block">
        <Image
          src="/images/pousada-1.png"
          alt="Pousada parceira da Rota das Pousadas"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="from-breu via-breu/75 absolute inset-0 bg-gradient-to-t from-15% via-55% to-transparent" />

        <div className="absolute top-10 left-10 z-10 xl:top-14 xl:left-14">
          <BrandMark />
        </div>

        <div className="text-linen absolute inset-x-0 bottom-0 z-10 p-10 xl:p-14">
          <span className="text-liquen inline-flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="text-ipe size-4" />
            Painel do parceiro
          </span>
          <h2 className="text-display-l mt-4">Sua pousada, sob controle total.</h2>
          <p className="text-linen/80 mt-5 max-w-lg text-lg leading-relaxed text-pretty">
            Reservas, hóspedes, financeiro e equipe — tudo num painel só, pensado pra quem
            administra uma pousada de verdade.
          </p>

          <div className="mt-9 grid grid-cols-2 gap-x-8 gap-y-6">
            {perks.map((perk) => (
              <div key={perk.title} className="flex items-start gap-3">
                <span className="bg-neblina/10 text-neblina flex size-11 shrink-0 items-center justify-center rounded-full">
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
                <div className="text-display-l font-light tabular-nums">{stat.value}</div>
                <div className="text-linen/65 mt-1 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-background flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-20">
        <div className="mx-auto w-full max-w-lg">
          {/* No desktop a logo já está no painel de foto ao lado. */}
          <div className="mb-10 flex justify-center lg:hidden">
            <BrandMark dark />
          </div>
          <h1 className="text-h1 text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-3 text-lg leading-relaxed">{subtitle}</p>
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </div>
  )
}
