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

  function submit(formData: FormData) {
    setMessage(null)
    setError(null)
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
        setError(result.error)
        return
      }
      setMessage('Configurações salvas.')
      router.refresh()
    })
  }

  return (
    <form action={submit} className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Input label="Nome da pousada" name="name" defaultValue={settings.name} />
        <Input label="Razão social" name="legalName" defaultValue={settings.legalName} />
        <Input label="Documento fiscal (CNPJ/CPF)" name="taxId" defaultValue={settings.taxId} />
        <Input label="Imagem principal" name="image" defaultValue={settings.image} />
        <Input label="Cidade" name="city" defaultValue={settings.city} />
        <Input label="Estado" name="state" defaultValue={settings.state} maxLength={2} />
        <Input label="País" name="country" defaultValue={settings.country} />
        <Input label="Endereço" name="address" defaultValue={settings.address} />
        <Input label="CEP" name="cep" defaultValue={settings.cep} placeholder="00000-000" />
        <Input
          label="Telefone de contato"
          name="contactPhone"
          defaultValue={settings.contactPhone}
          placeholder="(00) 00000-0000"
        />
        <Input
          label="WhatsApp"
          name="whatsapp"
          defaultValue={settings.whatsapp}
          placeholder="(00) 00000-0000"
        />
        <Input
          label="E-mail de notificações"
          name="notificationEmail"
          type="email"
          defaultValue={settings.notificationEmail}
          placeholder="reservas@pousada.com"
        />
        <Input label="Fuso horário" name="timezone" defaultValue={settings.timezone} />
        <Input label="Moeda (ISO)" name="currency" defaultValue={settings.currency} maxLength={3} />
        <Input label="Idioma" name="language" defaultValue={settings.language} />
        <Input label="Check-in" name="checkinTime" type="time" defaultValue={settings.checkinTime} />
        <Input label="Check-out" name="checkoutTime" type="time" defaultValue={settings.checkoutTime} />
      </div>

      <div className="grid gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tags
          </span>
          <input
            name="tags"
            defaultValue={settings.tags.join(', ')}
            placeholder="romântico, vista, pet friendly"
            className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Descrição pública
          </span>
          <textarea
            name="description"
            defaultValue={settings.description}
            rows={5}
            className="resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Regras da casa
          </span>
          <textarea
            name="houseRules"
            defaultValue={settings.houseRules}
            rows={4}
            placeholder="Ex.: silêncio após 22h, pets sob consulta..."
            className="resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Política de cancelamento
          </span>
          <textarea
            name="cancellationPolicy"
            defaultValue={settings.cancellationPolicy}
            rows={4}
            placeholder="Ex.: cancelamento grátis até 7 dias antes do check-in."
            className="resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          {message && <p className="text-sm font-medium text-primary">{message}</p>}
        </div>
        <Button type="submit" size="lg" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>
    </form>
  )
}
