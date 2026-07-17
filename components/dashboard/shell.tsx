'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Compass, Menu, X, Search, Bell, type LucideIcon } from 'lucide-react'

export type NavItem = { label: string; icon: LucideIcon; active?: boolean }

export function DashboardShell({
  nav,
  brandLabel,
  brandSub,
  title,
  subtitle,
  accent = 'primary',
  user,
  children,
}: {
  nav: NavItem[]
  brandLabel: string
  brandSub: string
  title: string
  subtitle: string
  accent?: 'primary' | 'ocean'
  user: { name: string; role: string }
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const accentBg = accent === 'ocean' ? 'bg-ocean' : 'bg-primary'
  const accentText = accent === 'ocean' ? 'text-ocean' : 'text-primary'
  const accentSoft = accent === 'ocean' ? 'bg-ocean/10' : 'bg-primary/10'

  return (
    <div className="min-h-screen bg-secondary/40">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-border bg-card transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-6 py-5">
            <Link href="/" className="flex items-center gap-2.5">
              <span className={`flex size-9 items-center justify-center rounded-full ${accentBg} text-primary-foreground`}>
                <Compass className="size-5" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-serif text-base font-semibold text-foreground">{brandLabel}</span>
                <span className="text-[11px] text-muted-foreground">{brandSub}</span>
              </span>
            </Link>
            <button onClick={() => setOpen(false)} className="lg:hidden" aria-label="Fechar menu">
              <X className="size-5 text-muted-foreground" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-2">
            {nav.map((item) => (
              <button
                key={item.label}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  item.active
                    ? `${accentSoft} ${accentText}`
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <item.icon className="size-5" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
              <span className={`flex size-10 items-center justify-center rounded-full ${accentBg} text-sm font-semibold text-primary-foreground`}>
                {user.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.role}</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-stone-deep/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-card/80 px-5 py-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="lg:hidden" aria-label="Abrir menu">
              <Menu className="size-6 text-foreground" />
            </button>
            <div>
              <h1 className="font-serif text-xl font-semibold text-foreground lg:text-2xl">{title}</h1>
              <p className="hidden text-sm text-muted-foreground sm:block">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-2 md:flex">
              <Search className="size-4 text-muted-foreground" />
              <input placeholder="Buscar..." className="w-40 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
            <button className="relative flex size-10 items-center justify-center rounded-full border border-border bg-card" aria-label="Notificações">
              <Bell className="size-5 text-foreground" />
              <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-accent" />
            </button>
          </div>
        </header>

        <main className="px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
