'use client'

import { useState, type ChangeEvent } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Loader2, Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { BR_UF_CODES } from '@/lib/validation/br'
import { maskCep, maskCpf, maskPhone } from '@/features/auth/profile'
import type { PrecheckinInput } from '../precheckin'

const selectClass =
  'border-input bg-card focus:border-foreground focus:ring-ipe/60 min-h-12 rounded-2xl border px-4 text-sm outline-none focus:ring-2'

type CepStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'unavailable'

/** Bloco "Seus dados": o responsável pela reserva, como na ficha (FNRH). */
export function PrecheckinGuestStep({
  form,
  fullName,
  storedDocumentLabel,
}: {
  form: UseFormReturn<PrecheckinInput>
  fullName: string
  /** "CPF •••.•••.•09-09" quando a ficha já tem documento do tipo certo. */
  storedDocumentLabel: string | null
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form
  const nationality = watch('nationality')
  const brazilian = nationality === 'brasileira'
  const hasStored = watch('hasStoredDocument')
  const [cepStatus, setCepStatus] = useState<CepStatus>('idle')

  const masked =
    (field: 'phone' | 'documentNumber', mask: (v: string) => string) =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setValue(field, mask(e.target.value), { shouldValidate: Boolean(errors[field]) })

  async function onCepChange(e: ChangeEvent<HTMLInputElement>) {
    const value = maskCep(e.target.value)
    setValue('cep', value, { shouldValidate: Boolean(errors.cep) })
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 8) {
      setCepStatus('idle')
      return
    }
    setCepStatus('loading')
    try {
      const res = await fetch(`/api/cep/${digits}`)
      if (res.status === 404) return setCepStatus('not_found')
      if (!res.ok) return setCepStatus('unavailable')
      const data = (await res.json()) as {
        street: string
        district: string
        city: string
        state: string
      }
      const opts = { shouldValidate: true, shouldDirty: true }
      if (data.street && !form.getValues('address')) {
        setValue('address', [data.street, data.district].filter(Boolean).join(', '), opts)
      }
      if (data.city) setValue('city', data.city, opts)
      if (data.state) setValue('state', data.state, opts)
      setCepStatus('found')
    } catch {
      setCepStatus('unavailable')
    }
  }

  const docRegister = register('documentNumber')
  const phoneRegister = register('phone')
  const cepRegister = register('cep')

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Responsável pela reserva: <strong className="text-foreground">{fullName}</strong>. Para
        trocar o nome, use Meu perfil.
      </p>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-foreground mb-1.5 text-sm font-medium">Nacionalidade</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['brasileira', 'estrangeira'] as const).map((n) => (
            <label
              key={n}
              className={cn(
                'flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border px-3 text-sm font-medium',
                nationality === n ? 'border-primary bg-primary/10 text-primary' : 'border-input',
              )}
            >
              <input
                type="radio"
                value={n}
                className="sr-only"
                {...register('nationality', {
                  // O documento salvo só vale se for do tipo da nacionalidade.
                  onChange: () => setValue('documentNumber', ''),
                })}
              />
              {n === 'brasileira' ? 'Brasileira' : 'Estrangeira'}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Data de nascimento"
          type="date"
          autoComplete="bday"
          error={errors.birthDate?.message}
          {...register('birthDate')}
        />
        <Input
          label="Celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={brazilian ? '(00) 00000-0000' : '+54 11 1234-5678'}
          error={errors.phone?.message}
          {...phoneRegister}
          onChange={masked('phone', maskPhone)}
        />
      </div>

      <Input
        label={brazilian ? 'CPF' : 'Número do passaporte'}
        inputMode={brazilian ? 'numeric' : 'text'}
        autoComplete="off"
        placeholder={
          hasStored && storedDocumentLabel
            ? `${storedDocumentLabel} — deixe em branco para manter`
            : brazilian
              ? '000.000.000-00'
              : 'Ex.: AB123456'
        }
        iconEnd={hasStored ? <Lock className="size-4" /> : undefined}
        hint={
          hasStored
            ? 'Documento salvo com criptografia. Só preencha se quiser trocar.'
            : 'Guardado com criptografia. Só esta pousada recebe.'
        }
        error={errors.documentNumber?.message}
        {...docRegister}
        onChange={(e) => {
          if (brazilian) masked('documentNumber', maskCpf)(e)
          else void docRegister.onChange(e)
        }}
      />

      {brazilian ? (
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Input
            label="CEP"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            iconEnd={
              cepStatus === 'loading' ? <Loader2 className="size-4 animate-spin" /> : undefined
            }
            hint={
              cepStatus === 'found'
                ? 'Endereço encontrado. Confira e complete o número.'
                : cepStatus === 'unavailable'
                  ? 'Busca de CEP indisponível agora. Preencha à mão.'
                  : 'Opcional. Com ele preenchemos a cidade.'
            }
            error={cepStatus === 'not_found' ? 'CEP não encontrado.' : errors.cep?.message}
            {...cepRegister}
            onChange={onCepChange}
          />
          <Input
            label="Endereço"
            autoComplete="street-address"
            placeholder="Rua, número e bairro"
            error={errors.address?.message}
            {...register('address')}
          />
        </div>
      ) : (
        <>
          <Input
            label="País onde você mora"
            autoComplete="country-name"
            error={errors.country?.message}
            {...register('country')}
          />
          <Input
            label="Endereço"
            autoComplete="street-address"
            error={errors.address?.message}
            {...register('address')}
          />
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Input
          label="Cidade"
          autoComplete="address-level2"
          error={errors.city?.message}
          {...register('city')}
        />
        {brazilian && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="precheckin-state" className="text-foreground text-sm font-medium">
              UF
            </label>
            <select
              id="precheckin-state"
              autoComplete="address-level1"
              className={selectClass}
              aria-invalid={errors.state ? true : undefined}
              {...register('state')}
            >
              <option value="">Selecione</option>
              {BR_UF_CODES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            {errors.state?.message && (
              <p className="text-destructive text-xs">{errors.state.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
