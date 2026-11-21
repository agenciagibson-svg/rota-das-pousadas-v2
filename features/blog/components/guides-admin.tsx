'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, EyeOff, Eye, MessageSquareQuote } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { formatPostDate } from '../posts'
import { setGuideHiddenAction } from '../actions'
import type { GuideRow } from '../services/guides.service'

const STATE: Record<
  GuideRow['state'],
  { label: string; variant: 'primarySoft' | 'outline' | 'destructiveSoft' }
> = {
  publicado: { label: 'No ar', variant: 'primarySoft' },
  rascunho: { label: 'Rascunho', variant: 'outline' },
  fora_do_ar: { label: 'Fora do ar', variant: 'destructiveSoft' },
}

/**
 * Guias do blog no painel (0113): situação de cada um, dicas recebidas, abrir
 * no site e tirar do ar / voltar ao ar. O texto do guia é editado pela equipe
 * de conteúdo; aqui a decisão é mostrar ou não.
 */
export function GuidesAdmin({ guides }: { guides: GuideRow[] }) {
  const router = useRouter()
  const [target, setTarget] = useState<GuideRow | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function apply(guide: GuideRow, hidden: boolean, why = '') {
    setError(null)
    startTransition(async () => {
      const res = await setGuideHiddenAction({ slug: guide.slug, hidden, reason: why })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setTarget(null)
      setReason('')
      router.refresh()
    })
  }

  return (
    <div>
      <ul className="divide-border divide-y">
        {guides.map((g) => {
          const state = STATE[g.state]
          return (
            <li key={g.slug} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
              <div className="min-w-0 flex-1 basis-72">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={state.variant} size="sm">
                    {state.label}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {g.place} · {formatPostDate(g.publishedAt)}
                  </span>
                </div>
                <p className="text-foreground mt-1 font-semibold">{g.title}</p>
                {g.state === 'fora_do_ar' && g.hiddenReason && (
                  <p className="text-muted-foreground mt-0.5 text-xs">Motivo: {g.hiddenReason}</p>
                )}
                {g.state === 'rascunho' && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Ainda não publicado: aparece só na versão de teste.
                  </p>
                )}
                <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                  <MessageSquareQuote className="size-3.5" aria-hidden />
                  {g.tips.approved} {g.tips.approved === 1 ? 'dica publicada' : 'dicas publicadas'}
                  {g.tips.pending > 0 && (
                    <strong className="text-foreground"> · {g.tips.pending} para revisar</strong>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {g.state === 'publicado' && (
                  <Link
                    href={`/blog/${g.slug}`}
                    target="_blank"
                    rel="noopener"
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    <ExternalLink className="size-4" /> Abrir
                  </Link>
                )}
                {g.state === 'publicado' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError(null)
                      setTarget(g)
                    }}
                  >
                    <EyeOff className="size-4" /> Tirar do ar
                  </Button>
                )}
                {g.state === 'fora_do_ar' && (
                  <Button size="sm" disabled={pending} onClick={() => apply(g, false)}>
                    <Eye className="size-4" /> Voltar ao ar
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {error && !target && (
        <p role="alert" className="text-destructive mt-2 text-sm font-medium">
          {error}
        </p>
      )}

      <Dialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Tirar o guia do ar?"
        description={
          target
            ? `"${target.title}" some do blog, do Google e da página das cidades. Dá para voltar quando quiser.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" size="touch" onClick={() => setTarget(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              size="touch"
              disabled={pending}
              onClick={() => target && apply(target, true, reason)}
            >
              <EyeOff className="size-4" /> {pending ? 'Tirando…' : 'Tirar do ar'}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-foreground font-medium">Motivo (opcional)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Ex.: revisar as fotos"
            className="border-input bg-card text-foreground focus:border-ring h-11 rounded-xl border px-3.5 text-sm outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-destructive mt-3 text-sm font-medium">
            {error}
          </p>
        )}
      </Dialog>
    </div>
  )
}
