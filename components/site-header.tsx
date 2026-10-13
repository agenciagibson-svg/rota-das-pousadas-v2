'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Menu,
  X,
  MapPin,
  Sparkles,
  BedDouble,
  Wand2,
  Heart,
  CalendarDays,
  ArrowUpRight,
  LogIn,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/logo'
import { useScrolled } from '@/hooks/use-scrolled'
import { useHeaderSummary } from '@/components/header/use-header-summary'
import { TripsButton } from '@/components/header/trips-button'
import { UserMenu, accountLinks, useSignOut } from '@/components/header/user-menu'

const nav = [
  {
    label: 'Destinos',
    href: '/#destinos',
    icon: MapPin,
    section: 'Explorar',
  },
  {
    label: 'Experiências',
    href: '/#experiencias',
    icon: Sparkles,
    section: 'Explorar',
  },
  {
    label: 'Pousadas',
    href: '/pousadas',
    icon: BedDouble,
    section: 'Explorar',
  },
  {
    label: 'Concierge',
    href: '/concierge',
    icon: Wand2,
    section: 'Explorar',
  },
  {
    label: 'Favoritos',
    href: '/favoritos',
    icon: Heart,
    section: 'Minha conta',
  },
  {
    label: 'Minhas reservas',
    href: '/minhas-reservas',
    icon: CalendarDays,
    section: 'Minha conta',
  },
]

const mobileSections = ['Explorar', 'Minha conta'] as const

export function SiteHeader({ forceSolid = false }: { forceSolid?: boolean }) {
  const scrolled = useScrolled(24)
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { summary } = useHeaderSummary()
  const { signOut, pending: signingOut } = useSignOut()
  const user = summary?.user ?? null
  const loggedOut = summary !== null && user === null

  const solid = forceSolid || scrolled

  // Menu do celular: Esc fecha e devolve o foco ao botão que abriu.
  const toggleRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Pílula de vidro flutuando sobre a foto; ao rolar (ou nas páginas
          internas, forceSolid) vira vidro claro com texto Breu. */}
      <header data-site-header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 lg:px-6 lg:pt-4">
        <div
          className={cn(
            'mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full border pr-2 pl-5 transition-colors duration-(--motion-fade) lg:pl-6',
            solid
              ? 'glass border-border/70 text-foreground shadow-floating'
              : 'glass-dark text-primary-foreground',
          )}
        >
          <Link
            href="/"
            aria-label="Rota das Pousadas, página inicial"
            className="flex items-center"
          >
            <Logo className="h-5 lg:h-6" />
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-8 lg:flex">
            {nav
              .filter((item) => item.section === 'Explorar')
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium transition-opacity duration-(--motion-hover) hover:opacity-70"
                >
                  {item.label}
                </Link>
              ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {summary?.user ? (
              <>
                {!summary.user.hasPousadaAccess && (
                  <Link
                    href="/anunciar"
                    className="text-sm font-semibold transition-opacity duration-(--motion-hover) hover:opacity-70"
                  >
                    Anuncie sua pousada
                  </Link>
                )}
                <TripsButton
                  pendingTrips={summary.pendingTrips}
                  nextTrip={summary.nextTrip}
                  solid={solid}
                />
                <UserMenu user={summary.user} solid={solid} />
              </>
            ) : (
              <>
                {loggedOut && (
                  <Link
                    href="/login"
                    className="flex items-center gap-1.5 px-2 text-sm font-semibold transition-opacity duration-(--motion-hover) hover:opacity-70"
                  >
                    <LogIn className="size-4" /> Entrar
                  </Link>
                )}
                <Link
                  href="/anunciar"
                  className="flex h-12 items-center rounded-full border border-current/35 px-5 text-sm font-semibold transition-colors duration-(--motion-hover) hover:bg-current/10"
                >
                  Anuncie sua pousada
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            aria-controls="menu-celular"
            ref={toggleRef}
            onClick={() => setOpen((v) => !v)}
            className="flex size-12 items-center justify-center rounded-full bg-current/10 transition-colors duration-(--motion-hover) lg:hidden"
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {open && (
          <div
            id="menu-celular"
            className="border-neblina/10 bg-breu text-neblina shadow-modal relative z-10 mx-auto mt-2 max-h-[calc(100dvh-6rem)] max-w-7xl overflow-y-auto overscroll-contain rounded-3xl border lg:hidden"
          >
            {user ? (
              <div className="border-neblina/10 flex items-center gap-3 border-b px-6 py-4">
                <span className="bg-neblina text-breu flex size-10 items-center justify-center rounded-full text-sm font-bold">
                  {user.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">Olá, {user.firstName}!</p>
                  <p className="text-liquen truncate text-xs">{user.email}</p>
                </div>
                {summary?.user && summary.pendingTrips.length > 0 && (
                  <Link
                    href="/minhas-reservas"
                    onClick={() => setOpen(false)}
                    className="bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs font-bold"
                  >
                    {summary.pendingTrips.length} a pagar
                  </Link>
                )}
              </div>
            ) : (
              loggedOut && (
                <div className="border-neblina/10 border-b p-3">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="bg-neblina/10 flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold"
                  >
                    <LogIn className="size-4" /> Entrar ou criar conta
                  </Link>
                </div>
              )
            )}
            <nav aria-label="Menu" className="flex flex-col p-3">
              {mobileSections.map((section, sectionIndex) => (
                <div
                  key={section}
                  className={sectionIndex > 0 ? 'border-neblina/10 mt-2 border-t pt-2' : ''}
                >
                  <p className="text-liquen px-3 pt-2 pb-1 text-xs font-semibold">{section}</p>
                  {(section === 'Minha conta' && user
                    ? accountLinks(user).map((l) => ({ ...l, section }))
                    : nav.filter((item) => item.section === section)
                  ).map((item) => {
                    const Icon = item.icon
                    const active = !item.href.includes('#') && pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-12 items-center gap-3 rounded-2xl px-3 text-base font-medium transition-colors duration-(--motion-hover)',
                          active ? 'bg-neblina/10' : 'hover:bg-neblina/10',
                        )}
                      >
                        <Icon className="text-liquen size-5" />
                        {item.label}
                        {active && <span className="bg-ipe ml-auto size-2 rounded-full" />}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </nav>
            <div className="border-neblina/10 space-y-2 border-t p-3">
              {user && (
                <button
                  type="button"
                  onClick={signOut}
                  disabled={signingOut}
                  className="text-liquen hover:bg-neblina/10 flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-medium"
                >
                  <LogOut className="size-4" /> {signingOut ? 'Saindo…' : 'Sair'}
                </button>
              )}
              <Link
                href="/anunciar"
                onClick={() => setOpen(false)}
                className="bg-neblina text-breu flex h-12 items-center justify-center gap-2 rounded-full px-5 text-center text-sm font-semibold"
              >
                Anuncie sua pousada
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
        )}
      </header>
      {open && (
        <div
          className="bg-breu/55 fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}
