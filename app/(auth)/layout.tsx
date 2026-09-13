import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Compass, MapPin, ShieldCheck, Sparkles, Star } from 'lucide-react'

function SponsoredStayCard() {
  return (
    <Link
      href="/pousadas?busca=Serra&oferta=patrocinado"
      className="group relative block min-h-[430px] overflow-hidden rounded-[2rem] border border-white/25 bg-stone-deep text-linen shadow-2xl shadow-stone-deep/15 lg:min-h-[560px]"
    >
      <Image
        src="/images/pousada-1.png"
        alt="Chale premium em destaque na Rota das Pousadas"
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 58vw"
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-stone-deep via-stone-deep/45 to-stone-deep/5" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-linen/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-deep">
          <Sparkles className="size-3.5 text-accent" />
          Destaque premium
        </span>
        <span className="flex size-11 items-center justify-center rounded-full bg-linen text-stone-deep transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
          <ArrowUpRight className="size-5" />
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
        <div className="mb-5 flex w-fit items-center gap-1 rounded-full bg-linen/12 px-3 py-1.5 text-sm font-semibold backdrop-blur-md">
          {[1, 2, 3, 4, 5].map((item) => (
            <Star key={item} className="size-3.5 fill-gold text-gold" />
          ))}
          <span className="ml-1 text-linen/85">4.9</span>
        </div>
        <p className="flex items-center gap-2 text-sm font-medium text-linen/75">
          <MapPin className="size-4" />
          Monte Verde, MG
        </p>
        <h2 className="mt-3 max-w-xl text-balance font-serif text-4xl font-semibold leading-tight sm:text-5xl">
          O refúgio que aparece antes da viagem começar.
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-linen/12 bg-linen/10 p-4 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.14em] text-linen/55">Diária</p>
            <p className="mt-1 text-lg font-semibold">R$ 720</p>
          </div>
          <div className="rounded-2xl border border-linen/12 bg-linen/10 p-4 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.14em] text-linen/55">Pacote</p>
            <p className="mt-1 text-lg font-semibold">Romance</p>
          </div>
          <div className="rounded-2xl border border-linen/12 bg-linen/10 p-4 backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.14em] text-linen/55">Mídia</p>
            <p className="mt-1 text-lg font-semibold">Patrocinado</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2 text-sm text-linen/70">
          <ShieldCheck className="size-4 text-primary" />
          Espaço reservado para uma pousada parceira da plataforma.
        </div>
      </div>
    </Link>
  )
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/40 px-5 py-8 lg:px-8 lg:py-6">
      <Link href="/" className="mx-auto flex w-fit items-center gap-2.5 lg:mb-6">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Compass className="size-5" />
        </span>
        <span className="font-serif text-lg font-semibold text-foreground">Rota das Pousadas</span>
      </Link>
      <main className="mx-auto grid min-h-[calc(100vh-7.5rem)] w-full max-w-7xl items-center gap-8 py-8 lg:min-h-[calc(100vh-7.75rem)] lg:grid-cols-[minmax(0,1.12fr)_minmax(380px,0.88fr)] lg:py-0">
        <div className="hidden lg:order-1 lg:block">
          <SponsoredStayCard />
        </div>
        <div className="order-1 mx-auto w-full max-w-md lg:order-2 lg:mx-0 lg:justify-self-end">
          {children}
        </div>
      </main>
    </div>
  )
}
