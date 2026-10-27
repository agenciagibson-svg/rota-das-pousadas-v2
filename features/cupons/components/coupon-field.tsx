'use client'

import { TicketPercent, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/format'
import type { CouponState } from './use-coupon'

/**
 * "Tenho um cupom" na reserva pelo site (0100). Mostra o desconto e o total
 * novo que o BANCO calculou (prévia) antes de confirmar.
 */
export function CouponField({ coupon, className }: { coupon: CouponState; className?: string }) {
  const { applied } = coupon

  if (!coupon.open && !applied) {
    return (
      <Button
        type="button"
        variant="link"
        className={cn('self-start px-0', className)}
        onClick={() => coupon.setOpen(true)}
      >
        <TicketPercent className="size-4" /> Tenho um cupom
      </Button>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-end gap-2">
        <Input
          id="reserva-cupom"
          label="Cupom de desconto"
          value={coupon.code}
          onChange={(e) => coupon.setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            // Enter aplica o cupom em vez de confirmar a reserva.
            if (e.key === 'Enter') {
              e.preventDefault()
              if (coupon.canApply) void coupon.apply()
            }
          }}
          maxLength={20}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="Ex.: DIRETO10"
          aria-invalid={coupon.error ? true : undefined}
          aria-describedby={coupon.error ? 'reserva-cupom-erro' : undefined}
          wrapperClassName="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={!coupon.canApply || coupon.applying}
          onClick={() => void coupon.apply()}
        >
          {coupon.applying ? 'Conferindo…' : 'Aplicar'}
        </Button>
      </div>
      {coupon.error && (
        <p id="reserva-cupom-erro" role="alert" className="text-destructive text-sm font-medium">
          {coupon.error}
        </p>
      )}
      {!coupon.canApply && !applied && coupon.code && (
        <p className="text-muted-foreground text-xs">
          Escolha as datas e espere o valor aparecer para aplicar o cupom.
        </p>
      )}

      {applied && (
        <div
          aria-live="polite"
          className="border-ipe/50 bg-ipe/15 space-y-1.5 rounded-2xl border p-4 text-sm tabular-nums"
        >
          <div className="text-foreground flex items-center justify-between gap-3">
            <span>
              Cupom <strong className="font-mono">{applied.code}</strong>
            </span>
            <span>−{formatBRL(applied.discount)}</span>
          </div>
          <div className="text-foreground flex justify-between gap-3 text-base font-semibold">
            <span>Total com desconto</span>
            <span>{formatBRL(applied.total)}</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={coupon.remove} className="-ml-2">
            <X className="size-3.5" /> Remover cupom
          </Button>
        </div>
      )}
    </div>
  )
}
