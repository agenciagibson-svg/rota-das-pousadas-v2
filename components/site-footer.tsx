import Link from 'next/link'
import { ArrowUpRight, CalendarDays, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FooterBrandCard } from '@/components/footer-brand-card'
import { FooterCompanyCard } from '@/components/footer-company-card'
import { FooterExploreCard } from '@/components/footer-explore-card'
import { FooterMobileLinks } from '@/components/footer-mobile-links'
import { FooterOwnerCard } from '@/components/footer-owner-card'

/** `withBottomBar`: a página tem uma barra presa ao pé da tela no celular (ex.: "Reservar agora"), então o rodapé ganha folga para ela não cobrir o fim. */
export function SiteFooter({ withBottomBar = false }: { withBottomBar?: boolean }) {
  return (
    <footer className={cn('bg-stone-deep text-linen', withBottomBar && 'pb-24 lg:pb-0')}>
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1.25fr_0.85fr_0.85fr]">
          <FooterBrandCard />
          <FooterMobileLinks />
          <div className="hidden lg:block">
            <FooterExploreCard />
          </div>
          <div className="hidden lg:block">
            <FooterOwnerCard />
          </div>
          <div className="hidden lg:block">
            <FooterCompanyCard />
          </div>
        </div>

        <nav
          aria-label="Acessos"
          className="border-linen/10 mt-16 flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center"
        >
          <p className="text-linen/55 text-sm sm:mr-2">Acesse sua área</p>
          <Link
            href="/minhas-reservas"
            className="border-linen/20 text-linen hover:bg-linen/10 inline-flex h-12 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors"
          >
            <CalendarDays className="size-4" aria-hidden />
            Área do hóspede
            <ArrowUpRight className="size-3.5 opacity-60" aria-hidden />
          </Link>
          <Link
            href="/dashboard"
            className="border-linen/20 text-linen hover:bg-linen/10 inline-flex h-12 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors"
          >
            <LayoutDashboard className="size-4" aria-hidden />
            Painel da pousada
            <ArrowUpRight className="size-3.5 opacity-60" aria-hidden />
          </Link>
        </nav>

        <div className="border-linen/10 text-linen/50 mt-8 flex flex-col gap-4 border-t pt-8 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Rota das Pousadas. Feito no Brasil.</p>
          <div className="flex gap-6">
            <Link href="/termos" className="hover:text-linen">
              Termos
            </Link>
            <Link href="/privacidade" className="hover:text-linen">
              Privacidade
            </Link>
            <Link href="/privacidade#cookies" className="hover:text-linen">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
