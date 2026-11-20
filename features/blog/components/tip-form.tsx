'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TurnstileWidget } from '@/components/security/turnstile-widget'
import { keepValuesOnSubmit, SAVE_FAILED_MESSAGE } from '@/lib/forms'
import { submitBlogTipAction } from '../actions'
import { resizePhoto } from '../resize-photo'
import { TipPhotoField } from './tip-photo-field'

const FIELD_ORDER = ['authorName', 'authorCity', 'body', 'photo', 'consent'] as const

/** "Já foi? Deixe sua dica" — entra na fila e só aparece depois de aprovada. */
export function TipForm({ postSlug, place }: { postSlug: string; place: string }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [photo, setPhoto] = useState<File | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [resetKey, setResetKey] = useState(0)

  async function onSubmit(formData: FormData) {
    setError(null)
    setFieldErrors({})
    setPending(true)
    try {
      formData.set('postSlug', postSlug)
      formData.set('turnstileToken', turnstileToken)
      if (photo) formData.set('photo', await resizePhoto(photo), 'foto.jpg')
      const result = await submitBlogTipAction(formData)
      if (!result.ok) {
        setError(result.error)
        const errors = result.fieldErrors ?? {}
        setFieldErrors(errors)
        const first = FIELD_ORDER.find((key) => errors[key])
        if (first) requestAnimationFrame(() => document.getElementById(`dica-${first}`)?.focus())
        return
      }
      setSent(true)
    } catch (e) {
      setError(e instanceof Error && e.message.includes('foto') ? e.message : SAVE_FAILED_MESSAGE)
    } finally {
      setPending(false)
      setResetKey((k) => k + 1)
    }
  }

  if (sent) {
    return (
      <Card radius="3xl" role="status" className="mt-6 p-6 text-center">
        <span className="bg-success/10 text-success mx-auto flex size-12 items-center justify-center rounded-full">
          <Check className="size-6" aria-hidden />
        </span>
        <p className="text-h3 text-foreground mt-3">Recebemos sua dica!</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Ela aparece aqui depois que a equipe da Rota revisar. Obrigado por ajudar quem vai viajar.
        </p>
      </Card>
    )
  }

  if (!open) {
    return (
      <Card
        radius="3xl"
        className="mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-foreground text-base">
          Já foi para {place}? Conte o que vale a pena para quem vai.
        </p>
        <Button size="pill" onClick={() => setOpen(true)} className="shrink-0">
          Deixar minha dica
        </Button>
      </Card>
    )
  }

  return (
    <Card radius="3xl" className="mt-6 p-6">
      <form onSubmit={keepValuesOnSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Como quer aparecer"
            id="dica-authorName"
            name="authorName"
            required
            maxLength={40}
            autoComplete="given-name"
            placeholder="Ex.: Ana"
            error={fieldErrors.authorName}
          />
          <Input
            label="Sua cidade (opcional)"
            id="dica-authorCity"
            name="authorCity"
            maxLength={40}
            placeholder="Ex.: Uberlândia"
            error={fieldErrors.authorCity}
          />
        </div>
        <Textarea
          label="Sua dica"
          id="dica-body"
          name="body"
          required
          rows={4}
          minLength={20}
          maxLength={600}
          placeholder="O que você recomenda, o horário bom, o que levar, onde comer…"
          error={fieldErrors.body}
        />
        <TipPhotoField onChange={setPhoto} error={fieldErrors.photo} />
        <label className="text-foreground flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="consent"
            id="dica-consent"
            required
            aria-invalid={fieldErrors.consent ? true : undefined}
            className="border-input accent-breu mt-0.5 size-5 shrink-0 rounded"
          />
          <span>
            Autorizo a Rota das Pousadas a publicar esta dica com o nome e a cidade que informei e,
            se enviei foto, declaro que a foto é minha.
          </span>
        </label>
        {fieldErrors.consent && (
          <span className="text-destructive text-xs">{fieldErrors.consent}</span>
        )}
        <TurnstileWidget onVerify={setTurnstileToken} resetKey={resetKey} />
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
            {pending ? 'Enviando…' : 'Enviar dica'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
