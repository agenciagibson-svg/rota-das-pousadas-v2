'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TicketPercent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { setCouponActiveAction, setCouponFeaturedAction } from '../actions'
import type { Coupon } from '../types'
import { CouponCard } from './coupon-card'
import { CouponForm } from './coupon-form'

/**
 * Cupons para quem reserva direto (0100), na página de Marketing do painel.
 * Só aparece para quem tem `coupon:manage` (dono e gestor).
 */
export function CouponsPanel({ coupons, todayISO }: { coupons: Coupon[]; todayISO: string }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível salvar.')
        return
      }
      router.refresh()
    })
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl">
            <TicketPercent className="size-5" />
          </span>
          <div>
            <h2 className="text-foreground font-semibold">Cupom para quem reserva direto</h2>
            <p className="text-muted-foreground text-sm">
              Dê ao hóspede um motivo para reservar pelo seu link em vez do Booking ou Airbnb.
            </p>
          </div>
        </div>
        <Button size="touch" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Novo cupom
        </Button>
      </div>

      <p className="text-muted-foreground mt-4 max-w-prose text-sm">
        Marque um cupom como <strong className="text-foreground">divulgado</strong> e ele aparece na
        página da bio e na página da pousada. O desconto vale só para reservas feitas pelo site, uma
        vez por hóspede; se a reserva for cancelada, o uso volta.
      </p>

      {error && (
        <p role="alert" className="text-destructive mt-4 text-sm font-medium">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {coupons.length === 0 ? (
          <EmptyState
            icon={TicketPercent}
            title="Nenhum cupom ainda"
            description="Crie um cupom como DIRETO10 (10% de desconto) e divulgue na bio do Instagram."
          />
        ) : (
          coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              todayISO={todayISO}
              pending={isPending}
              onToggleActive={() =>
                run(() => setCouponActiveAction({ id: coupon.id, on: !coupon.active }))
              }
              onToggleFeatured={() =>
                run(() => setCouponFeaturedAction({ id: coupon.id, on: !coupon.featured }))
              }
            />
          ))
        )}
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Novo cupom"
        className="max-w-xl"
      >
        {creating && <CouponForm onDone={() => setCreating(false)} />}
      </Dialog>
    </Card>
  )
}
