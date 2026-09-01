'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrolled } from '@/hooks/use-scrolled'

const nav = [
  { label: 'Destinos', href: '/#destinos' },
  { label: 'Experiências', href: '/#experiencias' },
  { label: 'Pousadas', href: '/pousadas' },
  { label: 'Concierge', href: '/concierge' },
  { label: 'Favoritos', href: '/favoritos' },
  { label: 'Minhas reservas', href: '/minhas-reservas' },
  { label: 'Dashboard', href: '/dashboard' },
]

export function SiteHeader({ forceSolid = false }: { forceSolid?: boolean }) {
  const scrolled = useScrolled(24)
  const [open, setOpen] = useState(false)

  const solid = forceSolid || scrolled

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        solid ? 'glass border-b border-border/60 py-3' : 'py-5',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-full transition-colors',
              solid ? 'bg-primary text-primary-foreground' : 'bg-primary-foreground/90 text-primary',
            )}
          >
            <Compass className="size-5" />
          </span>
          <span
            className={cn(
              'font-serif text-lg font-semibold leading-none tracking-tight transition-colors',
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
              solid
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary-foreground text-primary',
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
        <div className="glass mx-4 mt-3 rounded-2xl border border-border/60 p-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/anunciar"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"
            >
              Anuncie sua pousada
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
