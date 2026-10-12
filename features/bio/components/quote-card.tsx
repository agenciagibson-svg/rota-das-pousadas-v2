'use client'

import { useState } from 'react'
import { Check, MessageCircleMore } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
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
      <div role="status" className="bg-card rounded-3xl p-6 text-center">
        <span className="bg-success/10 text-success mx-auto flex size-12 items-center justify-center rounded-full">
          <Check className="size-6" />
        </span>
        <h2 className="text-h3 text-foreground mt-3">Pedido enviado</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          A pousada recebeu seus dados e vai responder com o orçamento. Guarde o número do seu
          telefone por perto.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-3xl p-5">
      <h2 className="text-h3 text-foreground">Precisa de um orçamento?</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Grupo grande, data especial, pedido fora do comum — conte o que precisa e a pousada responde
        com um valor fechado.
      </p>

      {!open ? (
        <div className="mt-4 flex flex-col gap-2">
          <Button size="lg" onClick={() => setOpen(true)}>
            Pedir orçamento
          </Button>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              <MessageCircleMore className="size-4" />
              Prefiro falar no WhatsApp
            </a>
          )}
        </div>
      ) : (
        <form onSubmit={keepValuesOnSubmit(onSubmit)} className="mt-5 flex flex-col gap-4">
          <Input
            label="Seu nome"
            error={fieldErrors.name}
            name="name"
            id="quote-name"
            required
            maxLength={150}
            autoComplete="name"
          />

          <Input
            label="WhatsApp"
            error={fieldErrors.phone}
            name="phone"
            id="quote-phone"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="(34) 99999-9999"
          />

          <Input
            label="E-mail (opcional)"
            error={fieldErrors.email}
            name="email"
            id="quote-email"
            type="email"
            inputMode="email"
            autoComplete="email"
          />

          <div className="flex gap-3">
            <Input
              label="Entrada"
              wrapperClassName="min-w-0 flex-1"
              name="checkin"
              id="quote-checkin"
              type="date"
              defaultValue={defaults.checkin}
            />
            <Input
              label="Saída"
              error={fieldErrors.checkout}
              wrapperClassName="min-w-0 flex-1"
              name="checkout"
              id="quote-checkout"
              type="date"
              defaultValue={defaults.checkout}
            />
          </div>

          <div className="flex gap-3">
            <Input
              label="Adultos"
              wrapperClassName="min-w-0 flex-1"
              name="adults"
              id="quote-adults"
              type="number"
              min={1}
              max={100}
              defaultValue={defaults.adults}
            />
            <Input
              label="Crianças"
              wrapperClassName="min-w-0 flex-1"
              name="children"
              id="quote-children"
              type="number"
              min={0}
              max={100}
              defaultValue={0}
            />
          </div>

          <label className="text-foreground flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="pets"
              id="quote-pets"
              className="border-input accent-breu size-5 rounded"
            />
            Vou levar pet
          </label>

          <Input
            label="Ocasião (opcional)"
            name="occasion"
            id="quote-occasion"
            maxLength={80}
            placeholder="Réveillon, casamento, retiro…"
          />

          <Textarea
            label="O que você precisa"
            name="message"
            id="quote-message"
            rows={3}
            maxLength={2000}
            placeholder="Ex.: somos duas famílias, precisamos de 3 quartos e café mais cedo."
          />

          <label className="text-foreground flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="consent"
              id="quote-consent"
              required
              className="border-input accent-breu mt-0.5 size-5 shrink-0 rounded"
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

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={pending} className="flex-1">
              {pending ? 'Enviando…' : 'Enviar pedido'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
