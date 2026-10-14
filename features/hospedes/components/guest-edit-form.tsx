'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { saveGuestAction } from '../actions'
import type { GuestDetail } from '../types'
import { SAVE_FAILED_MESSAGE, formErrorMessage, keepValuesOnSubmit } from '@/lib/forms'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  // O erro fica fora do <label> para não entrar no nome acessível do campo.
  return (
    <div>
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{label}</span>
        {children}
      </label>
      {error && (
        <p role="alert" className="text-destructive mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring aria-invalid:border-destructive'

/** Campos com lugar na tela para mostrar o erro; o resto vai para a mensagem geral. */
const VISIBLE_FIELDS = [
  'fullName',
  'preferredName',
  'email',
  'phone',
  'whatsapp',
  'documentType',
  'documentNumber',
  'birthDate',
  'nationality',
  'country',
  'city',
  'state',
  'address',
  'cep',
  'emergencyContactName',
  'emergencyContactPhone',
  'preferences',
  'dietaryRestrictions',
  'accessibilityNeeds',
  'internalNotes',
]

/** `preferences.2` (um item da lista) aponta para o mesmo campo de texto. */
function toFieldErrors(raw: Record<string, string> = {}) {
  const errors: Record<string, string> = {}
  for (const [key, msg] of Object.entries(raw)) {
    errors[key.startsWith('preferences.') ? 'preferences' : key] ??= msg
  }
  return errors
}

export function GuestEditForm({ guest }: { guest: GuestDetail }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  function submit(formData: FormData) {
    setError(null)
    setFieldErrors({})
    setSaved(false)
    const preferences = String(formData.get('preferences') || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    startTransition(async () => {
      // Sem o try/catch, uma queda de rede derrubava a tela no error boundary.
      try {
        const result = await saveGuestAction({
          guestId: guest.id,
          fullName: String(formData.get('fullName') || ''),
          preferredName: String(formData.get('preferredName') || ''),
          email: String(formData.get('email') || ''),
          phone: String(formData.get('phone') || ''),
          whatsapp: String(formData.get('whatsapp') || ''),
          documentType: String(formData.get('documentType') || ''),
          documentNumber: String(formData.get('documentNumber') || ''),
          birthDate: String(formData.get('birthDate') || ''),
          nationality: String(formData.get('nationality') || ''),
          country: String(formData.get('country') || 'BR'),
          city: String(formData.get('city') || ''),
          state: String(formData.get('state') || ''),
          address: String(formData.get('address') || ''),
          cep: String(formData.get('cep') || ''),
          emergencyContactName: String(formData.get('emergencyContactName') || ''),
          emergencyContactPhone: String(formData.get('emergencyContactPhone') || ''),
          preferences,
          dietaryRestrictions: String(formData.get('dietaryRestrictions') || ''),
          accessibilityNeeds: String(formData.get('accessibilityNeeds') || ''),
          internalNotes: String(formData.get('internalNotes') || ''),
          marketingConsent: formData.get('marketingConsent') === 'on',
        })
        if (!result.ok) {
          const errors = toFieldErrors(result.fieldErrors)
          setFieldErrors(errors)
          setError(formErrorMessage(result.error, errors, VISIBLE_FIELDS))
          return
        }
        setSaved(true)
        router.refresh()
      } catch {
        setError(SAVE_FAILED_MESSAGE)
      }
    })
  }

  return (
    <form onSubmit={keepValuesOnSubmit(submit)} className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome completo" error={fieldErrors.fullName}>
          <input
            name="fullName"
            aria-invalid={fieldErrors.fullName ? true : undefined}
            defaultValue={guest.fullName}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Nome preferido" error={fieldErrors.preferredName}>
          <input
            name="preferredName"
            aria-invalid={fieldErrors.preferredName ? true : undefined}
            defaultValue={guest.preferredName ?? ''}
            className={inputClass}
          />
        </Field>
      </section>

      {/* E-mail ocupa a linha inteira: endereço longo ficava cortado em 1/3. */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="E-mail" error={fieldErrors.email}>
            <input
              name="email"
              aria-invalid={fieldErrors.email ? true : undefined}
              type="email"
              defaultValue={guest.email ?? ''}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Telefone" error={fieldErrors.phone}>
          <input
            name="phone"
            aria-invalid={fieldErrors.phone ? true : undefined}
            defaultValue={guest.phone ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="WhatsApp" error={fieldErrors.whatsapp}>
          <input
            name="whatsapp"
            aria-invalid={fieldErrors.whatsapp ? true : undefined}
            defaultValue={guest.whatsapp ?? ''}
            className={inputClass}
          />
        </Field>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Field label="Tipo de documento" error={fieldErrors.documentType}>
          <input
            name="documentType"
            aria-invalid={fieldErrors.documentType ? true : undefined}
            defaultValue={guest.documentType ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Documento" error={fieldErrors.documentNumber}>
          <input
            name="documentNumber"
            aria-invalid={fieldErrors.documentNumber ? true : undefined}
            defaultValue={guest.documentNumber ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Nascimento" error={fieldErrors.birthDate}>
          <input
            name="birthDate"
            aria-invalid={fieldErrors.birthDate ? true : undefined}
            type="date"
            defaultValue={guest.birthDate ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Nacionalidade" error={fieldErrors.nationality}>
          <input
            name="nationality"
            aria-invalid={fieldErrors.nationality ? true : undefined}
            defaultValue={guest.nationality ?? ''}
            className={inputClass}
          />
        </Field>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Field label="País" error={fieldErrors.country}>
          <input
            name="country"
            aria-invalid={fieldErrors.country ? true : undefined}
            defaultValue={guest.country ?? 'BR'}
            className={inputClass}
          />
        </Field>
        <Field label="Cidade" error={fieldErrors.city}>
          <input
            name="city"
            aria-invalid={fieldErrors.city ? true : undefined}
            defaultValue={guest.city ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Estado" error={fieldErrors.state}>
          <input
            name="state"
            aria-invalid={fieldErrors.state ? true : undefined}
            defaultValue={guest.state ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Endereço" error={fieldErrors.address}>
          <input
            name="address"
            aria-invalid={fieldErrors.address ? true : undefined}
            defaultValue={guest.address ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="CEP" error={fieldErrors.cep}>
          <input
            name="cep"
            aria-invalid={fieldErrors.cep ? true : undefined}
            defaultValue={guest.cep ?? ''}
            placeholder="00000-000"
            className={inputClass}
          />
        </Field>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Contato de emergência — nome" error={fieldErrors.emergencyContactName}>
          <input
            name="emergencyContactName"
            aria-invalid={fieldErrors.emergencyContactName ? true : undefined}
            defaultValue={guest.emergencyContact.name ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Contato de emergência — telefone" error={fieldErrors.emergencyContactPhone}>
          <input
            name="emergencyContactPhone"
            aria-invalid={fieldErrors.emergencyContactPhone ? true : undefined}
            defaultValue={guest.emergencyContact.phone ?? ''}
            className={inputClass}
          />
        </Field>
      </section>

      <section className="grid gap-3">
        <Field label="Preferências (separadas por vírgula)" error={fieldErrors.preferences}>
          <input
            name="preferences"
            aria-invalid={fieldErrors.preferences ? true : undefined}
            defaultValue={guest.preferences.join(', ')}
            className={inputClass}
          />
        </Field>
        <Field label="Restrições alimentares" error={fieldErrors.dietaryRestrictions}>
          <textarea
            name="dietaryRestrictions"
            aria-invalid={fieldErrors.dietaryRestrictions ? true : undefined}
            defaultValue={guest.dietaryRestrictions}
            rows={2}
            className={inputClass}
          />
        </Field>
        <Field label="Necessidades de acessibilidade" error={fieldErrors.accessibilityNeeds}>
          <textarea
            name="accessibilityNeeds"
            aria-invalid={fieldErrors.accessibilityNeeds ? true : undefined}
            defaultValue={guest.accessibilityNeeds}
            rows={2}
            className={inputClass}
          />
        </Field>
        <Field
          label="Observações internas (nunca visível ao hóspede)"
          error={fieldErrors.internalNotes}
        >
          <textarea
            name="internalNotes"
            aria-invalid={fieldErrors.internalNotes ? true : undefined}
            defaultValue={guest.internalNotes}
            rows={3}
            className={inputClass}
          />
        </Field>
        <label className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="marketingConsent" defaultChecked={guest.marketingConsent} />
          Consentimento de comunicação de marketing
        </label>
      </section>

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
      {saved && !isPending && <p className="text-primary text-sm font-medium">Salvo.</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Salvando…' : 'Salvar alterações'}
      </Button>
    </form>
  )
}
