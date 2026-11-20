'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ImageOff, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { moderateBlogTipAction } from '../actions'
import type { BlogTipForReview, BlogTipStatus } from '../types'

const TABS: { status: BlogTipStatus; label: string }[] = [
  { status: 'pendente', label: 'Para revisar' },
  { status: 'aprovada', label: 'Publicadas' },
  { status: 'recusada', label: 'Recusadas' },
]

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

/** Fila de moderação das dicas dos leitores (/admin/blog). */
export function TipsModeration({
  tips,
  titles,
}: {
  tips: BlogTipForReview[]
  titles: Record<string, string>
}) {
  const router = useRouter()
  const [tab, setTab] = useState<BlogTipStatus>('pendente')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shown = tips.filter((t) => t.status === tab)

  async function decide(id: string, status: 'aprovada' | 'recusada') {
    setBusy(id)
    setError(null)
    const result = await moderateBlogTipAction({ id, status })
    setBusy(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = tips.filter((tip) => tip.status === t.status).length
          return (
            <Button
              key={t.status}
              role="tab"
              aria-selected={tab === t.status}
              size="pill-sm"
              variant={tab === t.status ? 'default' : 'outline'}
              onClick={() => setTab(t.status)}
            >
              {t.label} ({count})
            </Button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="text-destructive mt-4 text-sm">
          {error}
        </p>
      )}
      {shown.length === 0 ? (
        <EmptyState
          className="mt-6"
          title={tab === 'pendente' ? 'Nenhuma dica esperando revisão' : 'Nada por aqui'}
          description="As dicas enviadas no fim dos guias aparecem nesta lista."
        />
      ) : (
        <ul className="mt-6 grid gap-4">
          {shown.map((tip) => (
            <li key={tip.id}>
              <Card className="flex flex-col gap-4 p-4 sm:flex-row">
                {tip.photoUrl ? (
                  <a href={tip.photoUrl} target="_blank" rel="noopener" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada, só para a equipe */}
                    <img
                      src={tip.photoUrl}
                      alt={`Foto enviada por ${tip.authorName}`}
                      className="h-32 w-full rounded-2xl object-cover sm:w-44"
                    />
                  </a>
                ) : tip.photoMissing ? (
                  <span className="bg-muted text-muted-foreground flex h-32 w-full shrink-0 flex-col items-center justify-center gap-1 rounded-2xl text-xs sm:w-44">
                    <ImageOff className="size-5" aria-hidden />
                    Foto não chegou
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" size="sm">
                      {formatDateTime(tip.createdAt)}
                    </Badge>
                    <Link
                      href={`/blog/${tip.postSlug}`}
                      target="_blank"
                      className="text-muted-foreground truncate text-xs underline"
                    >
                      {titles[tip.postSlug] ?? tip.postSlug}
                    </Link>
                  </div>
                  <p className="text-foreground mt-2 text-sm leading-relaxed whitespace-pre-line">
                    {tip.body}
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    <span className="text-foreground font-semibold">{tip.authorName}</span>
                    {tip.authorCity && `, de ${tip.authorCity}`}
                  </p>
                </div>
                <div className={cn('flex shrink-0 gap-2 sm:flex-col')}>
                  {tip.status !== 'aprovada' && (
                    <Button
                      size="sm"
                      disabled={busy === tip.id}
                      onClick={() => decide(tip.id, 'aprovada')}
                    >
                      <Check className="size-4" aria-hidden />
                      Publicar
                    </Button>
                  )}
                  {tip.status !== 'recusada' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === tip.id}
                      onClick={() => decide(tip.id, 'recusada')}
                    >
                      <X className="size-4" aria-hidden />
                      {tip.status === 'aprovada' ? 'Tirar do ar' : 'Recusar'}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
