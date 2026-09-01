'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { saveGuestAction } from '../actions'
import type { GuestDetail } from '../types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring'

export function GuestEditForm({ guest }: { guest: GuestDetail }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function submit(formData: FormData) {
    setError(null)
    setSaved(false)
    const preferences = String(formData.get('preferences') || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    startTransition(async () => {
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
        emergencyContactName: String(formData.get('emergencyContactName') || ''),
        emergencyContactPhone: String(formData.get('emergencyContactPhone') || ''),
        preferences,
        dietaryRestrictions: String(formData.get('dietaryRestrictions') || ''),
        accessibilityNeeds: String(formData.get('accessibilityNeeds') || ''),
        internalNotes: String(formData.get('internalNotes') || ''),
        marketingConsent: formData.get('marketingConsent') === 'on',
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <form action={submit} className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome completo">
          <input name="fullName" defaultValue={guest.fullName} required className={inputClass} />
        </Field>
        <Field label="Nome preferido">
          <input name="preferredName" defaultValue={guest.preferredName ?? ''} className={inputClass} />
        </Field>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Field label="E-mail">
          <input name="email" type="email" defaultValue={guest.email ?? ''} className={inputClass} />
        </Field>
        <Field label="Telefone">
          <input name="phone" defaultValue={guest.phone ?? ''} className={inputClass} />
        </Field>
        <Field label="WhatsApp">
          <input name="whatsapp" defaultValue={guest.whatsapp ?? ''} className={inputClass} />
        </Field>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Field label="Tipo de documento">
          <input name="documentType" defaultValue={guest.documentType ?? ''} className={inputClass} />
        </Field>
        <Field label="Documento">
          <input name="documentNumber" defaultValue={guest.documentNumber ?? ''} className={inputClass} />
        </Field>
        <Field label="Nascimento">
          <input name="birthDate" type="date" defaultValue={guest.birthDate ?? ''} className={inputClass} />
        </Field>
        <Field label="Nacionalidade">
          <input name="nationality" defaultValue={guest.nationality ?? ''} className={inputClass} />
        </Field>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Field label="País">
          <input name="country" defaultValue={guest.country ?? 'BR'} className={inputClass} />
        </Field>
        <Field label="Cidade">
          <input name="city" defaultValue={guest.city ?? ''} className={inputClass} />
        </Field>
        <Field label="Estado">
          <input name="state" defaultValue={guest.state ?? ''} className={inputClass} />
        </Field>
        <Field label="Endereço">
          <input name="address" defaultValue={guest.address ?? ''} className={inputClass} />
        </Field>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Contato de emergência — nome">
          <input name="emergencyContactName" defaultValue={guest.emergencyContact.name ?? ''} className={inputClass} />
        </Field>
        <Field label="Contato de emergência — telefone">
          <input name="emergencyContactPhone" defaultValue={guest.emergencyContact.phone ?? ''} className={inputClass} />
        </Field>
      </section>

      <section className="grid gap-3">
        <Field label="Preferências (separadas por vírgula)">
          <input name="preferences" defaultValue={guest.preferences.join(', ')} className={inputClass} />
        </Field>
        <Field label="Restrições alimentares">
          <textarea name="dietaryRestrictions" defaultValue={guest.dietaryRestrictions} rows={2} className={inputClass} />
        </Field>
        <Field label="Necessidades de acessibilidade">
          <textarea name="accessibilityNeeds" defaultValue={guest.accessibilityNeeds} rows={2} className={inputClass} />
        </Field>
        <Field label="Observações internas (nunca visível ao hóspede)">
          <textarea name="internalNotes" defaultValue={guest.internalNotes} rows={3} className={inputClass} />
        </Field>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="marketingConsent" defaultChecked={guest.marketingConsent} />
          Consentimento de comunicação de marketing
        </label>
      </section>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      {saved && !isPending && <p className="text-sm font-medium text-primary">Salvo.</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Salvando…' : 'Salvar alterações'}
      </Button>
    </form>
  )
}
