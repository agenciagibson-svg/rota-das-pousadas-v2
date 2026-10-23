'use client'

import { useDashboardRole } from './role-context'
import { canAccessSection, sectionForHref } from '@/lib/auth/dashboard-sections'
import { roleLabel } from '@/features/membros/components/role-labels'
import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Menu, X, Globe, CalendarDays, type LucideIcon } from 'lucide-react'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { Marker } from '@/components/brand/logo'
import { NoticesBell } from './notices-bell'

export type NavItem = { label: string; icon: LucideIcon; active?: boolean; href?: string }

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
  // Dentro do painel da pousada: menu só com o que o papel pode abrir e o
  // rótulo real do papel (antes era sempre "Proprietário").
  const role = useDashboardRole()
  const visibleNav = role
    ? nav.filter((item) => {
        const section = item.href ? sectionForHref(item.href) : null
        return !section || canAccessSection(role, section)
      })
    : nav
  const roleText = role ? roleLabel(role) : user.role
  const accentBg = accent === 'ocean' ? 'bg-ocean' : 'bg-primary'
  const accentText = accent === 'ocean' ? 'text-ocean' : 'text-primary'
  const accentSoft = accent === 'ocean' ? 'bg-ocean/10' : 'bg-primary/10'

  return (
    <div className="bg-secondary/40 min-h-screen">
      {/* Sidebar */}
      <aside
        className={`border-border bg-card fixed inset-y-0 left-0 z-50 w-72 transform border-r transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-6 py-5">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                className={`flex size-9 items-center justify-center rounded-xl ${accentBg} text-neblina`}
              >
                <Marker className="size-5" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-foreground font-display text-base font-medium">
                  {brandLabel}
                </span>
                <span className="text-muted-foreground mt-0.5 text-xs">{brandSub}</span>
              </span>
            </Link>
            <button onClick={() => setOpen(false)} className="lg:hidden" aria-label="Fechar menu">
              <X className="text-muted-foreground size-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-2">
            {visibleNav.map((item) => {
              const cls = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                item.active
                  ? `${accentSoft} ${accentText}`
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`
              return item.href ? (
                <Link key={item.label} href={item.href} className={cls}>
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              ) : (
                <button key={item.label} className={cls}>
                  <item.icon className="size-5" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="border-border border-t p-4">
            <div className="mb-2 grid grid-cols-2 gap-2">
              <Link
                href="/"
                className="border-border text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium"
              >
                <Globe className="size-3.5" /> Ver o site
              </Link>
              <Link
                href="/minhas-reservas"
                className="border-border text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium"
              >
                <CalendarDays className="size-3.5" /> Minhas viagens
              </Link>
            </div>
            <div className="bg-secondary/60 flex items-center gap-3 rounded-xl p-3">
              <span
                className={`flex size-10 items-center justify-center rounded-full ${accentBg} text-primary-foreground text-sm font-semibold`}
              >
                {user.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-foreground truncate text-sm font-semibold">{user.name}</div>
                <div className="text-muted-foreground truncate text-xs">{roleText}</div>
              </div>
              <LogoutButton className="shrink-0" />
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="bg-stone-deep/40 fixed inset-0 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="lg:pl-72">
        <header className="border-border bg-card/80 sticky top-0 z-30 flex items-center justify-between gap-4 border-b px-5 py-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="-ml-2 flex size-11 items-center justify-center lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="text-foreground size-6" />
            </button>
            <div>
              <h1 className="text-foreground font-display text-xl font-medium lg:text-2xl">
                {title}
              </h1>
              <p className="text-muted-foreground hidden text-sm sm:block">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="border-border bg-card text-foreground hover:bg-secondary flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            >
              <Globe className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Ver o site</span>
            </Link>
            {/* Sino real (avisos do servidor). A busca falsa que ficava aqui saiu. */}
            <NoticesBell />
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className="px-5 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
