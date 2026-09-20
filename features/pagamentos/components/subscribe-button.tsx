'use client'

import { useState, useTransition } from 'react'
import { CreditCard } from 'lucide-react'
import { startSubscriptionAuthorizationAction } from '../actions'
import { Button } from '@/components/ui/button'

export function SubscribeButton({ reassinar = false }: { reassinar?: boolean }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await startSubscriptionAuthorizationAction({})
            if (!result.ok) {
              setError(result.error)
              return
            }
            window.location.href = result.data.redirectTo
          })
        }
      >
        <CreditCard className="size-4" />
        {pending ? 'Gerando link…' : reassinar ? 'Reassinar' : 'Assinar agora'}
      </Button>
      {error && <p className="text-destructive mt-2 text-xs font-medium">{error}</p>}
    </div>
  )
}
