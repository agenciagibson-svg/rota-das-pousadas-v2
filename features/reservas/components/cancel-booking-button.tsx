'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cancelBookingAction } from '../actions'

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function cancelBooking() {
    const confirmed = window.confirm('Deseja cancelar esta reserva?')
    if (!confirmed) return

    setError(null)
    startTransition(async () => {
      const result = await cancelBookingAction({ bookingId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={cancelBooking}
        disabled={isPending}
      >
        <XCircle className="size-3.5" />
        {isPending ? 'Cancelando…' : 'Cancelar'}
      </Button>
      {error && <span className="text-destructive text-xs font-medium">{error}</span>}
    </div>
  )
}
