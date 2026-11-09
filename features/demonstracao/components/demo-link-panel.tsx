'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, ExternalLink, Eye, MessageCircle, RefreshCw, Link2Off } from 'lucide-react'
import { createDemoLinkAction, revokeDemoLinkAction } from '../actions'
import { publicEnv } from '@/lib/env'
import { demoPath, demoWhatsappHref, timeAgo, type DemoLinkInfo } from '../demo'

const chip =
  'border-border text-foreground hover:bg-secondary inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50'

/**
 * Link de demonstração de uma pousada não publicada (0101), na lista de
 * pousadas do /admin: gerar, copiar, mandar no WhatsApp, abrir, trocar e
 * desativar, com quantas vezes foi aberto.
 */
export function DemoLinkPanel({
  pousadaId,
  pousadaName,
  link,
}: {
  pousadaId: string
  pousadaName: string
  link: DemoLinkInfo | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  // Token recém-gerado aparece antes de a lista recarregar.
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const token = freshToken ?? (link?.active ? link.token : null)
  // Endereço oficial: é ele que vai para a pousada, mesmo gerado num preview.
  const url = token ? `${publicEnv.siteUrl}${demoPath(token)}` : null

  function generate(renew: boolean) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await createDemoLinkAction({ pousadaId, renew })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setFreshToken(result.data.token)
      setNotice(renew ? 'Link trocado. O anterior não abre mais.' : 'Link criado.')
      router.refresh()
    })
  }

  function revoke() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await revokeDemoLinkAction({ pousadaId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setFreshToken(null)
      setConfirmRevoke(false)
      setNotice('Link desativado.')
      router.refresh()
    })
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Link copiado.')
    } catch {
      setNotice(url)
    }
  }

  return (
    <div className="bg-background flex flex-col gap-3 rounded-xl p-3">
      {!url ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Página privada para mostrar ao dono como a pousada ficaria na Rota. Não aparece no site
            nem no Google, e não aceita reserva.
          </p>
          <button
            type="button"
            className={chip}
            disabled={isPending}
            onClick={() => generate(false)}
          >
            {isPending ? 'Gerando…' : 'Gerar link de demonstração'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={url}
              aria-label="Link de demonstração"
              onFocus={(e) => e.currentTarget.select()}
              className="border-border bg-card text-foreground min-h-9 min-w-0 flex-1 rounded-lg border px-3 text-xs"
            />
            <button type="button" className={chip} onClick={() => void copy()}>
              <Copy className="size-3.5" /> Copiar
            </button>
            <a
              className={chip}
              href={demoWhatsappHref(pousadaName, url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
            <a className={chip} href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" /> Abrir
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Eye className="size-3.5" />
              {link?.active && !freshToken && link.views > 0 && link.lastViewedAt
                ? `Aberto ${link.views} ${link.views === 1 ? 'vez' : 'vezes'} · última ${timeAgo(link.lastViewedAt)}`
                : 'Ainda não foi aberto'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={chip}
                disabled={isPending}
                onClick={() => generate(true)}
              >
                <RefreshCw className="size-3.5" /> Trocar link
              </button>
              {confirmRevoke ? (
                <>
                  <button
                    type="button"
                    className={`${chip} text-destructive`}
                    disabled={isPending}
                    onClick={revoke}
                  >
                    Confirmar: desativar
                  </button>
                  <button
                    type="button"
                    className={chip}
                    disabled={isPending}
                    onClick={() => setConfirmRevoke(false)}
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={chip}
                  disabled={isPending}
                  onClick={() => setConfirmRevoke(true)}
                >
                  <Link2Off className="size-3.5" /> Desativar
                </button>
              )}
            </div>
          </div>
        </>
      )}
      {notice && <p className="text-foreground text-xs">{notice}</p>}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
