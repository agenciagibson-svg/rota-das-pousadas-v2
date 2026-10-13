'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/ui/image-upload'
import type { OwnerPousadaSettings } from '../types'
import { updatePousadaSettingsAction } from '../actions'
import { keepValuesOnSubmit } from '@/lib/forms'

/** Fusos do Brasil com nome amigável; o valor gravado é o nome IANA. */
const TIME_ZONES: { value: string; label: string }[] = [
  { value: 'America/Sao_Paulo', label: 'Brasília (SP, RJ, MG, Sul, GO, DF, BA…)' },
  { value: 'America/Bahia', label: 'Bahia' },
  { value: 'America/Fortaleza', label: 'Fortaleza (CE, RN, PB, PI, MA)' },
  { value: 'America/Recife', label: 'Recife (PE)' },
  { value: 'America/Maceio', label: 'Maceió (AL, SE)' },
  { value: 'America/Belem', label: 'Belém (PA, AP)' },
  { value: 'America/Santarem', label: 'Santarém (oeste do PA)' },
  { value: 'America/Araguaina', label: 'Araguaína (TO)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (MT)' },
  { value: 'America/Campo_Grande', label: 'Campo Grande (MS)' },
  { value: 'America/Manaus', label: 'Manaus (AM)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (RO)' },
  { value: 'America/Boa_Vista', label: 'Boa Vista (RR)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (AC)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha' },
]

const LANGUAGES = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en', label: 'Inglês' },
  { value: 'es', label: 'Espanhol' },
]

const SELECT_CLASS =
  'border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 rounded-xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3'

function SelectField({
  label,
  name,
  defaultValue,
  options,
  error,
}: {
  label: string
  name: string
  defaultValue: string
  options: { value: string; label: string }[]
  error?: string
}) {
  // Valor antigo fora da lista continua selecionável (não some ao salvar).
  const all =
    options.some((o) => o.value === defaultValue) || !defaultValue
      ? options
      : [{ value: defaultValue, label: defaultValue }, ...options]
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-foreground text-sm font-medium">{label}</span>
      <select name={name} defaultValue={defaultValue} className={SELECT_CLASS}>
        {all.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </label>
  )
}

export function OwnerSettingsForm({ settings }: { settings: OwnerPousadaSettings }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<string[]>(() => {
    const list =
      settings.gallery.length > 0 ? settings.gallery : settings.image ? [settings.image] : []
    return list.filter(Boolean)
  })

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
      image: photos[0] ?? '',
      gallery: photos,
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
    <form onSubmit={keepValuesOnSubmit(submit)} className="space-y-6">
      <ImageUpload
        label="Fotos da pousada"
        value={photos}
        onChange={setPhotos}
        folder={settings.id}
        max={20}
        error={fieldErrors.gallery ?? fieldErrors.image}
        hint="A primeira é a capa. Até 20 fotos (JPG, PNG ou WEBP, até 10 MB). Depois de enviar, clique em Salvar configurações."
      />

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
        <SelectField
          label="Fuso horário"
          name="timezone"
          defaultValue={settings.timezone || 'America/Sao_Paulo'}
          options={TIME_ZONES}
          error={fieldErrors.timezone}
        />
        <SelectField
          label="Moeda"
          name="currency"
          defaultValue={settings.currency || 'BRL'}
          options={[{ value: 'BRL', label: 'Real (R$)' }]}
          error={fieldErrors.currency}
        />
        <SelectField
          label="Idioma"
          name="language"
          defaultValue={settings.language || 'pt-BR'}
          options={LANGUAGES}
          error={fieldErrors.language}
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
          <span className="text-foreground text-sm font-medium">Tags</span>
          <input
            name="tags"
            defaultValue={settings.tags.join(', ')}
            placeholder="romântico, vista, pet friendly"
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 rounded-xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
          />
          {fieldErrors.tags && <span className="text-destructive text-xs">{fieldErrors.tags}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-foreground text-sm font-medium">Descrição pública</span>
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
          <span className="text-foreground text-sm font-medium">Regras da casa</span>
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
          <span className="text-foreground text-sm font-medium">Política de cancelamento</span>
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
