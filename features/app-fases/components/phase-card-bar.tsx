'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, CalendarCheck, CreditCard, KeyRound, Star, X } from 'lucide-react'
import type { PhaseCard } from '../phase'

const ICON = {
  estadia: KeyRound,
  escolher: KeyRound,
  viagem: CalendarCheck,
  pos: Star,
  pendente: CreditCard,
} as const

function isDismissed(key: string | undefined): boolean {
  if (!key) return false
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/**
 * Atalho da fase na loja: quem está hospedado, com viagem marcada ou acabou de
 * sair vê, por cima da home, o caminho de volta para a estadia (ou a avaliação).
 * Busca no cliente para a home continuar igual para todos.
 */
export function PhaseCardBar() {
  const [card, setCard] = useState<PhaseCard | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/me/fase', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { card: null }))
      .then((d: { card: PhaseCard | null }) => {
        if (alive && d.card && !isDismissed(d.card.dismissKey)) setCard(d.card)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!card) return null
  const Icon = ICON[card.kind]

  function dismiss() {
    try {
      if (card?.dismissKey) localStorage.setItem(card.dismissKey, '1')
    } catch {
      // sem storage: some só nesta visita
    }
    setCard(null)
  }

  return (
    <aside
      aria-label="Sua viagem"
      className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 sm:inset-x-auto sm:top-24 sm:right-6 sm:bottom-auto sm:w-[360px] lg:top-28"
    >
      <div className="bg-breu text-neblina shadow-floating flex items-center gap-3 rounded-[28px] p-2.5 pl-3">
        <span className="bg-ipe text-breu grid size-11 shrink-0 place-items-center rounded-full">
          <Icon className="size-5" aria-hidden />
        </span>
        <Link href={card.href} className="group min-w-0 flex-1 py-0.5">
          <span className="text-liquen block truncate text-xs">{card.eyebrow}</span>
          <span className="block truncate text-[15px] font-semibold">{card.title}</span>
          <span className="text-ipe mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold">
            {card.cta}
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
        {card.dismissKey && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dispensar"
            className="text-liquen hover:text-neblina grid size-11 shrink-0 place-items-center rounded-full"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </aside>
  )
}
