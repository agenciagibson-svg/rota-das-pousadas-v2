import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, MapPin, ShieldCheck, Sparkles, Star } from 'lucide-react'
import { Logo } from '@/components/brand/logo'

/** Painel de foto do login (desktop): a pousada em destaque ocupa a metade da tela. */
function SponsoredStayCard() {
  return (
    <Link
      href="/pousadas?busca=Serra&oferta=patrocinado"
      className="group bg-breu text-neblina absolute inset-3 block overflow-hidden rounded-3xl"
    >
      <Image
        src="/images/pousada-1.png"
        alt="Chale premium em destaque na Rota das Pousadas"
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 55vw"
        className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
      />
      <div className="from-breu via-breu/40 to-breu/10 absolute inset-0 bg-gradient-to-t" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-6">
        <span className="bg-neblina text-breu inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
          <Sparkles className="size-3.5" />
          Destaque premium
        </span>
        <span className="bg-neblina text-breu flex size-11 items-center justify-center rounded-full transition-transform duration-(--motion-hover) group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
          <ArrowUpRight className="size-5" />
        </span>
      </div>

      <div className="absolute right-0 bottom-0 left-0 p-8 xl:p-10">
        <div className="glass-dark mb-5 flex w-fit items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold">
          {[1, 2, 3, 4, 5].map((item) => (
            <Star key={item} className="fill-ipe text-ipe size-3.5" />
          ))}
          <span className="text-neblina/85 ml-1 tabular-nums">4.9</span>
        </div>
        <p className="text-neblina/75 flex items-center gap-2 text-sm font-medium">
          <MapPin className="size-4" />
          Monte Verde, MG
        </p>
        <h2 className="text-display-l mt-3 max-w-xl">
          O refúgio que aparece antes da viagem começar.
        </h2>
        <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-3">
          {[
            ['Diária', 'R$ 720'],
            ['Pacote', 'Romance'],
            ['Mídia', 'Patrocinado'],
          ].map(([label, value]) => (
            <div key={label} className="glass-dark rounded-2xl border p-4">
              <p className="text-liquen text-xs">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <div className="text-neblina/70 mt-5 flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4" />
          Espaço reservado para uma pousada parceira da plataforma.
        </div>
      </div>
    </Link>
  )
}

/**
 * Login, cadastro e recuperação de senha: foto da pousada em destaque à
 * esquerda (desktop) e o formulário sobre Neblina à direita, com a logo C.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background min-h-screen lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(28rem,0.9fr)]">
      <div className="relative hidden lg:block">
        <SponsoredStayCard />
      </div>
      <div className="flex min-h-screen flex-col px-5 py-6 lg:px-12 lg:py-8">
        <Link
          href="/"
          aria-label="Rota das Pousadas, página inicial"
          className="text-foreground w-fit"
        >
          <Logo className="h-6" />
        </Link>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {children}
        </main>
      </div>
    </div>
  )
}
