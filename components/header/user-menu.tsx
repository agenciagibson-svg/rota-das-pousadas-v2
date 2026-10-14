'use client'

import Link from 'next/link'
import { useCallback, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOutAction } from '@/features/auth/actions'
import { useDismiss } from './use-dismiss'

export type HeaderUser = {
  firstName: string
  fullName: string
  email: string
  initials: string
  hasPousadaAccess: boolean
  isPlatformStaff: boolean
}

export function accountLinks(user: HeaderUser) {
  return [
    { label: 'Minhas reservas', href: '/minhas-reservas', icon: CalendarDays },
    { label: 'Favoritos', href: '/favoritos', icon: Heart },
    { label: 'Meu perfil', href: '/conta', icon: UserRound },
    ...(user.hasPousadaAccess
      ? [{ label: 'Painel da pousada', href: '/dashboard', icon: LayoutDashboard }]
      : []),
    ...(user.isPlatformStaff
      ? [{ label: 'Painel master', href: '/admin', icon: ShieldCheck }]
      : []),
  ]
}

export function useSignOut() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const signOut = () =>
    start(async () => {
      await signOutAction()
      router.push('/')
      router.refresh()
    })
  return { signOut, pending }
}

/** Avatar com iniciais + primeiro nome; abre o menu da conta. */
export function UserMenu({ user, solid }: { user: HeaderUser; solid: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const { signOut, pending } = useSignOut()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Menu da conta"
        className={cn(
          'flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 transition-colors',
          solid
            ? 'border-border bg-card text-foreground hover:bg-secondary'
            : 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20',
        )}
      >
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-xs font-bold">
          {user.initials}
        </span>
        <span className="max-w-28 truncate text-sm font-semibold">{user.firstName}</span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-border bg-card text-foreground absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border shadow-2xl">
          <div className="border-border flex items-center gap-3 border-b px-4 py-3">
            <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
              {user.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Olá, {user.firstName}!</p>
              <p className="text-muted-foreground truncate text-xs">{user.email}</p>
            </div>
          </div>
          <nav className="p-2">
            {accountLinks(user).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="hover:bg-secondary flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium"
              >
                <item.icon className="text-muted-foreground size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-border border-t p-2">
            <button
              type="button"
              onClick={signOut}
              disabled={pending}
              className="text-muted-foreground hover:bg-secondary hover:text-foreground flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium"
            >
              <LogOut className="size-4" />
              {pending ? 'Saindo…' : 'Sair'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
