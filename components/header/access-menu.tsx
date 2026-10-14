'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronDown, LayoutDashboard, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDismiss } from './use-dismiss'

/**
 * Atalhos de quem ainda não entrou: área do hóspede ou painel da pousada.
 * Os links vão direto para a área; sem sessão, o `proxy.ts` leva ao login
 * certo (hóspede ou parceiro) e volta para ela depois.
 */
export const accessLinks = [
  {
    label: 'Área do hóspede',
    detail: 'Reservas, pagamentos e app da estadia',
    href: '/minhas-reservas',
    icon: CalendarDays,
  },
  {
    label: 'Painel da pousada',
    detail: 'Reservas, acomodações, financeiro e equipe',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
] as const

export function AccessMenu({ solid }: { solid: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="menu-acesso"
        className="flex h-12 items-center gap-1.5 px-2 text-sm font-semibold transition-opacity duration-(--motion-hover) hover:opacity-70"
      >
        <LogIn className="size-4" aria-hidden /> Entrar
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <div
          id="menu-acesso"
          className={cn(
            'border-border bg-card text-foreground absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border p-2 shadow-2xl',
            !solid && 'mt-4',
          )}
        >
          <nav aria-label="Acessos">
            {accessLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="hover:bg-secondary flex items-start gap-3 rounded-xl px-3 py-2.5"
              >
                <item.icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="text-muted-foreground block text-xs">{item.detail}</span>
                </span>
              </Link>
            ))}
          </nav>
          <div className="border-border mt-1 border-t px-3 pt-2 pb-1">
            <Link
              href="/cadastro"
              onClick={close}
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              Ainda não tem conta? Criar conta
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
