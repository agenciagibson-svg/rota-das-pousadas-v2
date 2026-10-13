'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Compartilhar a pousada: menu nativo do celular quando existe, senão copia o
 * link. `glass` é a versão só com ícone, sobre a foto.
 */
export function ShareButton({
  name,
  variant = 'outline',
}: {
  name: string
  variant?: 'outline' | 'glass'
}) {
  const [shared, setShared] = useState(false)
  const glass = variant === 'glass'

  async function handleShare() {
    const shareData = {
      title: name,
      text: `Confira ${name} na Rota das Pousadas`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard && shareData.url) {
        await navigator.clipboard.writeText(shareData.url)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch {
      // Usuário cancelou o compartilhamento nativo — não é erro.
    }
  }

  const label = shared ? 'Link copiado!' : 'Compartilhar'
  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={glass ? label : undefined}
      className={
        glass
          ? cn(buttonVariants({ variant: 'glass', size: 'icon-pill' }), 'glass-dark')
          : buttonVariants({ variant: 'outline', size: 'pill' })
      }
    >
      <Share2 className="size-5" />
      {!glass && label}
      <span aria-live="polite" className="sr-only">
        {shared ? 'Link copiado!' : ''}
      </span>
    </button>
  )
}
