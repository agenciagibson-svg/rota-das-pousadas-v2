'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { Heart, Loader2 } from 'lucide-react'
import { toggleFavoriteAction } from '@/features/favoritos/actions'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Salvar nos favoritos. `outline`: pílula com texto, sobre fundo claro.
 * `glass`: só o coração, em vidro escuro, sobre a foto (o texto vira rótulo
 * acessível). Salva = coração cheio em Ipê.
 */
export function FavoriteButton({
  slug,
  initialFavorite,
  isLoggedIn,
  className,
  variant = 'outline',
}: {
  slug: string
  initialFavorite: boolean
  isLoggedIn: boolean
  className?: string
  variant?: 'outline' | 'glass'
}) {
  const [favorite, setFavorite] = useState(initialFavorite)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const glass = variant === 'glass'
  const shape = glass
    ? cn(buttonVariants({ variant: 'glass', size: 'icon-pill' }), 'glass-dark')
    : buttonVariants({ variant: 'outline', size: 'pill' })
  const label = favorite ? 'Salva' : 'Salvar'

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/favoritos/salvar/${slug}`)}`}
        aria-label={glass ? 'Salvar' : undefined}
        className={cn(shape, className)}
      >
        <Heart className="size-5" />
        {!glass && 'Salvar'}
      </Link>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError('')
          const previous = favorite
          setFavorite(!favorite)
          startTransition(async () => {
            const result = await toggleFavoriteAction({ slug })
            if (result.ok) {
              setFavorite(result.data.favorite)
              return
            }
            setFavorite(previous)
            setError(result.error)
          })
        }}
        className={cn(shape, isPending && 'opacity-70', className)}
        aria-pressed={favorite}
        aria-label={glass ? label : undefined}
      >
        {isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Heart
            className={cn(
              'size-5 transition-transform duration-(--motion-hover)',
              favorite && 'fill-ipe text-ipe scale-110',
            )}
          />
        )}
        {!glass && label}
      </button>
      {error ? (
        <p
          role="alert"
          className="border-destructive/20 bg-card text-destructive shadow-card absolute top-full right-0 z-10 mt-2 w-56 rounded-lg border p-2 text-xs"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
