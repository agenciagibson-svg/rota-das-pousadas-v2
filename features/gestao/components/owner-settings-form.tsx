'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { OwnerPousadaSettings } from '../types'
import { updatePousadaSettingsAction } from '../actions'

export function OwnerSettingsForm({ settings }: { settings: OwnerPousadaSettings }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function submit(formData: FormData) {
    setMessage(null)
    setError(null)
    setFieldErrors({})
    const input = {
      name: String(formData.get('name') ?? ''),
      legalName: String(formData.get('legalName') ?? ''),
      taxId: String(formData.get('taxId') ?? ''),
      city: String(formData.get('city') ?? ''),
      state: String(formData.get('state') ?? ''),
      country: String(formData.get('country') ?? ''),
      address: String(formData.get('address') ?? ''),
      cep: String(formData.get('cep') ?? ''),
      image: String(formData.get('image') ?? ''),
      description: String(formData.get('description') ?? ''),
      tags: String(formData.get('tags') ?? ''),
      timezone: String(formData.get('timezone') ?? ''),
      currency: String(formData.get('currency') ?? ''),
      language: String(formData.get('language') ?? ''),
      checkinTime: String(formData.get('checkinTime') ?? ''),
      checkoutTime: String(formData.get('checkoutTime') ?? ''),
      contactPhone: String(formData.get('contactPhone') ?? ''),
      whatsapp: String(formData.get('whatsapp') ?? ''),
      notificationEmail: String(formData.get('notificationEmail') ?? ''),
      houseRules: String(formData.get('houseRules') ?? ''),
      cancellationPolicy: String(formData.get('cancellationPolicy') ?? ''),
    }

    startTransition(async () => {
      const result = await updatePousadaSettingsAction(input)
      if (!result.ok) {
        // Erro de validação vem por campo: destaca o campo em vez de só "Dados inválidos."
        setError(result.fieldErrors ? 'Revise os campos destacados.' : result.error)
        setFieldErrors(result.fieldErrors ?? {})
        return
      }
      setMessage('Configurações salvas.')
      router.refresh()
    })
  }

  return (
    <form action={submit} className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Input
          label="Nome da pousada"
          name="name"
          error={fieldErrors.name}
          defaultValue={settings.name}
        />
        <Input
          label="Razão social"
          name="legalName"
          error={fieldErrors.legalName}
          defaultValue={settings.legalName}
        />
        <Input
          label="Documento fiscal (CNPJ/CPF)"
          name="taxId"
          error={fieldErrors.taxId}
          defaultValue={settings.taxId}
        />
        <Input
          label="Imagem principal"
          name="image"
          error={fieldErrors.image}
          defaultValue={settings.image}
        />
        <Input label="Cidade" name="city" error={fieldErrors.city} defaultValue={settings.city} />
        <Input
          label="Estado"
          name="state"
          error={fieldErrors.state}
          defaultValue={settings.state}
          maxLength={2}
        />
        <Input
          label="País"
          name="country"
          error={fieldErrors.country}
          defaultValue={settings.country}
        />
        <Input
          label="Endereço"
          name="address"
          error={fieldErrors.address}
          defaultValue={settings.address}
        />
        <Input
          label="CEP"
          name="cep"
          error={fieldErrors.cep}
          defaultValue={settings.cep}
          placeholder="00000-000"
        />
        <Input
          label="Telefone de contato"
          name="contactPhone"
          error={fieldErrors.contactPhone}
          defaultValue={settings.contactPhone}
          placeholder="(00) 00000-0000"
        />
        <Input
          label="WhatsApp"
          name="whatsapp"
          error={fieldErrors.whatsapp}
          defaultValue={settings.whatsapp}
          placeholder="(00) 00000-0000"
        />
        <Input
          label="E-mail de notificações"
          name="notificationEmail"
          error={fieldErrors.notificationEmail}
          type="email"
          defaultValue={settings.notificationEmail}
          placeholder="reservas@pousada.com"
        />
        <Input
          label="Fuso horário"
          name="timezone"
          error={fieldErrors.timezone}
          defaultValue={settings.timezone}
        />
        <Input
          label="Moeda (ISO)"
          name="currency"
          error={fieldErrors.currency}
          defaultValue={settings.currency}
          maxLength={3}
        />
        <Input
          label="Idioma"
          name="language"
          error={fieldErrors.language}
          defaultValue={settings.language}
        />
        <Input
          label="Check-in"
          name="checkinTime"
          error={fieldErrors.checkinTime}
          type="time"
          defaultValue={settings.checkinTime}
        />
        <Input
          label="Check-out"
          name="checkoutTime"
          error={fieldErrors.checkoutTime}
          type="time"
          defaultValue={settings.checkoutTime}
        />
      </div>

      <div className="grid gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Tags
          </span>
          <input
            name="tags"
            defaultValue={settings.tags.join(', ')}
            placeholder="romântico, vista, pet friendly"
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 rounded-xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
          />
          {fieldErrors.tags && <span className="text-destructive text-xs">{fieldErrors.tags}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Descrição pública
          </span>
          <textarea
            name="description"
            defaultValue={settings.description}
            rows={5}
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 resize-none rounded-xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
          />
          {fieldErrors.description && (
            <span className="text-destructive text-xs">{fieldErrors.description}</span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Regras da casa
          </span>
          <textarea
            name="houseRules"
            defaultValue={settings.houseRules}
            rows={4}
            placeholder="Ex.: silêncio após 22h, pets sob consulta..."
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 resize-none rounded-xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
          />
          {fieldErrors.houseRules && (
            <span className="text-destructive text-xs">{fieldErrors.houseRules}</span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Política de cancelamento
          </span>
          <textarea
            name="cancellationPolicy"
            defaultValue={settings.cancellationPolicy}
            rows={4}
            placeholder="Ex.: cancelamento grátis até 7 dias antes do check-in."
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 resize-none rounded-xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
          />
          {fieldErrors.cancellationPolicy && (
            <span className="text-destructive text-xs">{fieldErrors.cancellationPolicy}</span>
          )}
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {error && <p className="text-destructive text-sm font-medium">{error}</p>}
          {message && <p className="text-primary text-sm font-medium">{message}</p>}
        </div>
        <Button type="submit" size="lg" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>
    </form>
  )
}
