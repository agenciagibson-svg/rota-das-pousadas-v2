'use client'

import { useState } from 'react'
import { Check, MessageCircleMore } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { submitQuoteRequestAction } from '../actions'
import { TurnstileWidget } from './turnstile-widget'
import { keepValuesOnSubmit } from '@/lib/forms'

/**
 * Pedido de orçamento — a alternativa ao "manda no WhatsApp".
 *
 * Existe porque o calendário não sabe precificar tudo: grupo grande, réveillon,
 * casamento, meia pensão. Hoje isso vira conversa solta e se perde. Aqui vira
 * registro no painel, com as datas e o número de pessoas já preenchidos a
 * partir do que a pessoa acabou de buscar.
 */
export function QuoteCard({
  pousadaId,
  whatsapp,
  defaults,
}: {
  pousadaId: string
  whatsapp: string | null
  defaults: { checkin: string; checkout: string; adults: number }
}) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')

  async function onSubmit(formData: FormData) {
    setError(null)
    setFieldErrors({})
    setPending(true)
    const result = await submitQuoteRequestAction({
      pousadaId,
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      email: String(formData.get('email') ?? ''),
      checkin: String(formData.get('checkin') ?? ''),
      checkout: String(formData.get('checkout') ?? ''),
      adults: Number(formData.get('adults') ?? 1),
      children: Number(formData.get('children') ?? 0),
      pets: formData.get('pets') === 'on',
      occasion: String(formData.get('occasion') ?? ''),
      message: String(formData.get('message') ?? ''),
      consent: formData.get('consent') === 'on',
      turnstileToken,
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      setFieldErrors(result.fieldErrors ?? {})
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="border-primary/40 bg-primary/5 rounded-2xl border p-5 text-center">
        <Check className="text-primary mx-auto size-6" />
        <h2 className="text-foreground mt-2 font-serif text-lg font-semibold">Pedido enviado</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          A pousada recebeu seus dados e vai responder com o orçamento. Guarde o número do seu
          telefone por perto.
        </p>
      </div>
    )
  }

  return (
    <div className="border-border bg-card rounded-2xl border p-5">
      <h2 className="text-foreground font-serif text-lg font-semibold">Precisa de um orçamento?</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Grupo grande, data especial, pedido fora do comum — conte o que precisa e a pousada responde
        com um valor fechado.
      </p>

      {!open ? (
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={() => setOpen(true)}>Pedir orçamento</Button>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-input text-foreground hover:bg-secondary inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
            >
              <MessageCircleMore className="size-4" />
              Prefiro falar no WhatsApp
            </a>
          )}
        </div>
      ) : (
        <form onSubmit={keepValuesOnSubmit(onSubmit)} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Seu nome
            </span>
            <Input name="name" id="quote-name" required maxLength={150} autoComplete="name" />
            {fieldErrors.name && (
              <span className="text-destructive text-xs">{fieldErrors.name}</span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              WhatsApp
            </span>
            <Input
              name="phone"
              id="quote-phone"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="(34) 99999-9999"
            />
            {fieldErrors.phone && (
              <span className="text-destructive text-xs">{fieldErrors.phone}</span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              E-mail (opcional)
            </span>
            <Input
              name="email"
              id="quote-email"
              type="email"
              inputMode="email"
              autoComplete="email"
            />
            {fieldErrors.email && (
              <span className="text-destructive text-xs">{fieldErrors.email}</span>
            )}
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Entrada
              </span>
              <Input
                name="checkin"
                id="quote-checkin"
                type="date"
                defaultValue={defaults.checkin}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Saída
              </span>
              <Input
                name="checkout"
                id="quote-checkout"
                type="date"
                defaultValue={defaults.checkout}
              />
            </label>
          </div>
          {fieldErrors.checkout && (
            <span className="text-destructive text-xs">{fieldErrors.checkout}</span>
          )}

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Adultos
              </span>
              <Input
                name="adults"
                id="quote-adults"
                type="number"
                min={1}
                max={100}
                defaultValue={defaults.adults}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Crianças
              </span>
              <Input
                name="children"
                id="quote-children"
                type="number"
                min={0}
                max={100}
                defaultValue={0}
              />
            </label>
          </div>

          <label className="text-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="pets"
              id="quote-pets"
              className="border-input size-4 rounded"
            />
            Vou levar pet
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Ocasião (opcional)
            </span>
            <Input
              name="occasion"
              id="quote-occasion"
              maxLength={80}
              placeholder="Réveillon, casamento, retiro…"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              O que você precisa
            </span>
            <Textarea
              name="message"
              id="quote-message"
              rows={3}
              maxLength={2000}
              placeholder="Ex.: somos duas famílias, precisamos de 3 quartos e café mais cedo."
            />
          </label>

          <label className="text-foreground flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="consent"
              id="quote-consent"
              required
              className="border-input mt-0.5 size-4 rounded"
            />
            <span>
              Concordo que meus dados sejam usados pela pousada só pra responder este pedido de
              orçamento.
            </span>
          </label>
          {fieldErrors.consent && (
            <span className="text-destructive text-xs">{fieldErrors.consent}</span>
          )}

          <TurnstileWidget onVerify={setTurnstileToken} />

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? 'Enviando…' : 'Enviar pedido'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
