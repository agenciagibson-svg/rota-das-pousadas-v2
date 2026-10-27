'use client'

import { useState, useTransition } from 'react'
import {
  CalendarPlus,
  Check,
  Copy,
  Link2Off,
  MessageCircleMore,
  RefreshCw,
  Share2,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { revokeBookingShareAction, shareBookingAction } from '../actions'
import { shareTripMessage, whatsappShareUrl } from '../share'

/**
 * Depois de reservar (h9): "Adicionar à agenda" (baixa o .ics gerado no
 * servidor só para o dono da reserva) e "Enviar para quem vai comigo" (link só
 * de leitura, criado na hora do clique — 0094).
 */
export function BookingTripActions({
  bookingId,
  pousadaName,
  checkin,
  checkout,
}: {
  bookingId: string
  pousadaName: string
  checkin: string
  checkout: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  function share(renew: boolean) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await shareBookingAction({ bookingId, renew })
      if (!result.ok) return setError(result.error)
      setUrl(result.data.url)
      if (renew) setNotice('Link novo criado. O anterior não abre mais.')
    })
  }

  function revoke() {
    setError(null)
    startTransition(async () => {
      const result = await revokeBookingShareAction({ bookingId })
      if (!result.ok) return setError(result.error)
      setUrl(null)
      setNotice('Link desativado. Quem tinha o link não consegue mais abrir.')
    })
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sem área de transferência: o link está no campo, já selecionável.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={`/minhas-reservas/${bookingId}/agenda.ics`}
          download
          className={buttonVariants({ variant: 'outline', size: 'pill-sm' })}
        >
          <CalendarPlus className="size-3.5" />
          Adicionar à agenda
        </a>
        {!url && (
          <Button
            type="button"
            variant="outline"
            size="pill-sm"
            disabled={pending}
            onClick={() => share(false)}
          >
            <Share2 className="size-3.5" />
            {pending ? 'Criando link…' : 'Enviar para quem vai comigo'}
          </Button>
        )}
      </div>

      {url && (
        <div className="bg-secondary flex flex-col gap-3 rounded-2xl p-4">
          <p className="text-muted-foreground text-sm">
            Quem receber vê só a pousada, o endereço, as datas, os horários e o código da reserva —
            sem valores nem os seus dados.
          </p>
          <Input
            id={`link-viagem-${bookingId}`}
            readOnly
            value={url}
            label="Link da viagem"
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="flex flex-wrap gap-2">
            <a
              href={whatsappShareUrl(shareTripMessage({ pousadaName, checkin, checkout, url }))}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'pill-sm' })}
            >
              <MessageCircleMore className="size-3.5" />
              Enviar no WhatsApp
            </a>
            <Button type="button" variant="outline" size="pill-sm" onClick={() => copy(url)}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Link copiado' : 'Copiar link'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="pill-sm"
              disabled={pending}
              onClick={() => share(true)}
            >
              <RefreshCw className="size-3.5" />
              Gerar outro link
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="pill-sm"
              disabled={pending}
              onClick={revoke}
            >
              <Link2Off className="size-3.5" />
              Desativar link
            </Button>
          </div>
        </div>
      )}

      <span aria-live="polite" className="text-muted-foreground text-sm empty:hidden">
        {copied ? 'Link copiado.' : notice}
      </span>
      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
