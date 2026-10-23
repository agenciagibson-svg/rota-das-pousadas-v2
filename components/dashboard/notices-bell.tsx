'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { noticeBadgeCount, type NoticeTone } from '@/features/dashboard/notices'
import { useDashboardNotices } from './notices-context'

const TONE_ICON: Record<NoticeTone, typeof Info> = {
  urgent: AlertTriangle,
  action: Bell,
  info: Info,
}

/**
 * Sino do painel: abre a lista de avisos reais (comprovante Pix para aprovar,
 * pedido novo, canal que falhou…). O número é de avisos que pedem ação.
 * Ao abrir, pede ao servidor a lista atualizada (o layout não re-renderiza
 * sozinho ao trocar de página).
 */
export function NoticesBell() {
  const notices = useDashboardNotices()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [refreshing, startRefresh] = useTransition()
  const panelId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (notices === null) return null
  const count = noticeBadgeCount(notices)

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) startRefresh(() => router.refresh())
  }

  return (
    <div ref={wrapRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon-pill"
        className="relative size-11"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={count > 0 ? `Avisos: ${count} pedem atenção` : 'Avisos'}
        onClick={toggle}
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="bg-accent text-accent-foreground absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>

      {open && (
        <Card
          id={panelId}
          role="region"
          aria-label="Avisos da pousada"
          className="shadow-floating absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2.5rem))] p-2"
        >
          {notices.length === 0 ? (
            <p className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
              <CheckCircle2 className="text-success size-5" />
              Tudo em dia. Nenhum aviso agora.
            </p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto">
              {notices.map((n) => {
                const Icon = TONE_ICON[n.tone]
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="hover:bg-secondary flex min-h-14 items-start gap-3 rounded-xl p-3"
                    >
                      <Icon
                        className={cn(
                          'mt-0.5 size-5 shrink-0',
                          n.tone === 'urgent' ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block text-sm font-semibold">
                          {n.title}
                        </span>
                        {n.detail && (
                          <span className="text-muted-foreground block text-sm">{n.detail}</span>
                        )}
                      </span>
                      <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {refreshing && (
            <p className="text-muted-foreground px-3 pb-2 text-xs" aria-live="polite">
              Atualizando…
            </p>
          )}
        </Card>
      )}
    </div>
  )
}
