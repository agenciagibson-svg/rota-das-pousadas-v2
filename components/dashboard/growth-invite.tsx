'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, Megaphone, Rocket } from 'lucide-react'
import { formatDateTime, formatISODate } from '@/lib/format'
import { requestGrowthHelpAction } from '@/features/admin/growth-actions'
import type { OwnerGrowthCard } from '@/features/admin/services/growth.service'
import { buttonVariants } from '@/components/ui/button'

/** Convite do painel da pousada: diagnóstico rápido + "Tenho interesse" em tráfego pago. */
export function GrowthInvite({ card }: { card: NonNullable<OwnerGrowthCard> }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [sentAt, setSentAt] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const { status, checklist } = card
  const interestAt = sentAt ?? status.interestAt
  const active = status.stage === 'campanha_ativa'
  const missing = checklist.filter((c) => !c.ok)

  async function ask() {
    setErr(null)
    setPending(true)
    try {
      const res = await requestGrowthHelpAction({})
      if (!res.ok) setErr(res.error)
      else {
        setSentAt(res.data.interestAt)
        router.refresh()
      }
    } catch {
      setErr('Não foi possível enviar. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  if (active) {
    return (
      <div className="border-border bg-card mt-5 flex items-start gap-3 rounded-2xl border p-5">
        <span className="bg-success/10 text-success grid size-10 shrink-0 place-items-center rounded-full">
          <Rocket className="size-5" />
        </span>
        <div>
          <h2 className="text-foreground font-semibold">Campanha de anúncios ativa</h2>
          <p className="text-muted-foreground text-sm">
            {status.campaignStart ? `Desde ${formatISODate(status.campaignStart)}. ` : ''}A equipe
            da Rota acompanha os resultados e fala com você sobre os ajustes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="border-border bg-card mt-5 grid gap-5 rounded-2xl border p-5 lg:grid-cols-[1fr_auto]">
      <div className="flex items-start gap-3">
        <span className="bg-ipe/25 text-foreground grid size-10 shrink-0 place-items-center rounded-full">
          <Megaphone className="size-5" />
        </span>
        <div>
          <h2 className="text-foreground font-semibold">Quer receber mais reservas?</h2>
          <p className="text-muted-foreground text-sm">
            A Rota cria anúncios (tráfego pago) no Instagram e no Google que levam viajantes direto
            para a página de reserva da sua pousada.
            {missing.length > 0
              ? ' Para o anúncio render mais, complete antes:'
              : ' Seu perfil está pronto para anunciar.'}
          </p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                {c.ok ? (
                  <CheckCircle2 className="text-success size-4" />
                ) : (
                  <Circle className="text-muted-foreground size-4" />
                )}
                <span className={c.ok ? 'text-muted-foreground' : 'text-foreground'}>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-col items-start justify-center gap-2 lg:items-end">
        {interestAt ? (
          <p className="text-success max-w-xs text-sm lg:text-right">
            Pedido enviado em {formatDateTime(interestAt)}. A equipe da Rota vai falar com você pelo
            WhatsApp.
          </p>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => void ask()}
            className={buttonVariants({ variant: 'accent', size: 'pill' })}
          >
            {pending ? 'Enviando…' : 'Tenho interesse'}
          </button>
        )}
        {err && (
          <p role="alert" className="text-destructive text-sm font-medium">
            {err}
          </p>
        )}
      </div>
    </div>
  )
}
