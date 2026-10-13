'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { CheckCircle2, QrCode } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { savePixSettingsAction } from '../actions'
import { PIX_KEY_TYPE_LABEL, displayPixKey, pixSettingsSchema, type PixSettingsInput } from '../pix'

const KEY_PLACEHOLDER: Record<PixSettingsInput['keyType'], string> = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  email: 'financeiro@suapousada.com.br',
  telefone: '(00) 00000-0000',
  aleatoria: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
}

/** Chave Pix da pousada para receber direto na conta (0075). Só o proprietário edita. */
export function PixSettingsForm({
  initial,
  canEdit,
}: {
  initial: PixSettingsInput | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(!initial && canEdit)
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PixSettingsInput>({
    resolver: zodResolver(pixSettingsSchema),
    defaultValues: initial ?? {
      keyType: 'cnpj',
      pixKey: '',
      holderName: '',
      city: '',
      enabled: true,
    },
  })
  const keyType = watch('keyType')

  async function onSubmit(values: PixSettingsInput) {
    setFormError(null)
    const result = await savePixSettingsAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    setSaved(true)
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <div className="mt-2 space-y-2 text-sm">
        {initial ? (
          <>
            <p className="text-muted-foreground">
              {initial.enabled
                ? 'Recebendo Pix direto na chave'
                : 'Pix direto desativado. Chave cadastrada'}{' '}
              <strong className="text-foreground">
                {PIX_KEY_TYPE_LABEL[initial.keyType]}{' '}
                {displayPixKey(initial.keyType, initial.pixKey)}
              </strong>{' '}
              ({initial.holderName}).
            </p>
            {saved && (
              <p className="text-success flex items-center gap-1.5">
                <CheckCircle2 className="size-4" /> Chave salva.
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            Cadastre a chave Pix da pousada: o hóspede paga pelo QR Code, o dinheiro cai direto na
            sua conta, sem taxa, e você aprova o comprovante aqui no painel.
          </p>
        )}
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            <QrCode className="size-4" />
            {initial ? 'Alterar chave Pix' : 'Cadastrar chave Pix'}
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">
            Só o proprietário pode alterar a chave Pix.
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-3 flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="keyType" className="text-foreground text-sm font-medium">
          Tipo de chave
        </label>
        <select
          id="keyType"
          className="border-input bg-card focus:border-ring focus:ring-ring/20 rounded-xl border px-3.5 py-2.5 text-sm focus:ring-3 focus:outline-none"
          {...register('keyType')}
        >
          {Object.entries(PIX_KEY_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Input
        label="Chave Pix"
        placeholder={KEY_PLACEHOLDER[keyType]}
        autoComplete="off"
        error={errors.pixKey?.message}
        {...register('pixKey')}
      />
      <Input
        label="Nome de quem recebe"
        placeholder="Como aparece no banco (razão social ou nome)"
        hint="O hóspede vê esse nome no app do banco antes de pagar — use o mesmo da conta."
        error={errors.holderName?.message}
        {...register('holderName')}
      />
      <Input
        label="Cidade da conta"
        placeholder="Ex.: Monte Verde"
        error={errors.city?.message}
        {...register('city')}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" {...register('enabled')} />
        Oferecer Pix direto aos hóspedes
      </label>
      {formError && <p className="text-destructive text-sm font-medium">{formError}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar chave Pix'}
        </Button>
        {initial && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
