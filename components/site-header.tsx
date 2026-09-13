'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Menu,
  X,
  Compass,
  MapPin,
  Sparkles,
  BedDouble,
  Wand2,
  Heart,
  CalendarDays,
  LayoutDashboard,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrolled } from '@/hooks/use-scrolled'

type Tone = 'primary' | 'ocean' | 'gold' | 'accent'

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary/15 text-primary',
  ocean: 'bg-ocean/15 text-ocean',
  gold: 'bg-gold/15 text-gold',
  accent: 'bg-accent/15 text-accent',
}

const nav = [
  {
    label: 'Destinos',
    href: '/#destinos',
    icon: MapPin,
    tone: 'primary' as Tone,
    section: 'Explorar',
  },
  {
    label: 'Experiências',
    href: '/#experiencias',
    icon: Sparkles,
    tone: 'gold' as Tone,
    section: 'Explorar',
  },
  {
    label: 'Pousadas',
    href: '/pousadas',
    icon: BedDouble,
    tone: 'ocean' as Tone,
    section: 'Explorar',
  },
  {
    label: 'Concierge',
    href: '/concierge',
    icon: Wand2,
    tone: 'accent' as Tone,
    section: 'Explorar',
  },
  {
    label: 'Favoritos',
    href: '/favoritos',
    icon: Heart,
    tone: 'accent' as Tone,
    section: 'Minha conta',
  },
  {
    label: 'Minhas reservas',
    href: '/minhas-reservas',
    icon: CalendarDays,
    tone: 'primary' as Tone,
    section: 'Minha conta',
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    tone: 'ocean' as Tone,
    section: 'Minha conta',
  },
]

const mobileSections = ['Explorar', 'Minha conta'] as const

export function SiteHeader({ forceSolid = false }: { forceSolid?: boolean }) {
  const scrolled = useScrolled(24)
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const solid = forceSolid || scrolled

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-500',
          solid ? 'glass border-border/60 border-b py-3' : 'py-5',
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex size-9 items-center justify-center rounded-full transition-colors',
                solid
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-primary-foreground/90 text-primary',
              )}
            >
              <Compass className="size-5" />
            </span>
            <span
              className={cn(
                'font-serif text-lg leading-none font-semibold tracking-tight transition-colors',
                solid ? 'text-foreground' : 'text-primary-foreground',
              )}
            >
              Rota das Pousadas
            </span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:opacity-70',
                  solid ? 'text-foreground' : 'text-primary-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/anunciar"
              className={cn(
                'rounded-full px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-105',
                solid ? 'bg-primary text-primary-foreground' : 'bg-primary-foreground text-primary',
              )}
            >
              Anuncie sua pousada
            </Link>
          </div>

          <button
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'flex size-10 items-center justify-center rounded-full transition-colors lg:hidden',
              solid ? 'text-foreground' : 'text-primary-foreground',
            )}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {open && (
          <div className="border-linen/10 bg-stone-deep shadow-stone-deep/40 relative z-10 mx-4 mt-3 overflow-hidden rounded-3xl border shadow-2xl lg:hidden">
            <div className="from-primary via-gold to-accent h-1 w-full bg-gradient-to-r" />
            <nav className="flex flex-col p-3">
              {mobileSections.map((section, sectionIndex) => (
                <div
                  key={section}
                  className={sectionIndex > 0 ? 'border-linen/10 mt-2 border-t pt-2' : ''}
                >
                  <p className="text-linen/40 px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                    {section}
                  </p>
                  {nav
                    .filter((item) => item.section === section)
                    .map((item) => {
                      const Icon = item.icon
                      const active = !item.href.includes('#') && pathname === item.href
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
                            active
                              ? 'bg-linen/10 text-linen'
                              : 'text-linen/80 hover:bg-linen/10 hover:text-linen',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
                              toneClasses[item.tone],
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          {item.label}
                          {active && <span className="bg-accent ml-auto size-1.5 rounded-full" />}
                        </Link>
                      )
                    })}
                </div>
              ))}
            </nav>
            <div className="border-linen/10 border-t p-3">
              <Link
                href="/anunciar"
                onClick={() => setOpen(false)}
                className="bg-accent text-accent-foreground flex items-center justify-center gap-2 rounded-full px-5 py-3 text-center text-sm font-semibold transition-all hover:brightness-105"
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
          className="bg-stone-deep/55 fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}
