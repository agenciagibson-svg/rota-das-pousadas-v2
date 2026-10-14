'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import '@/lib/validation/zod-pt'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BR_UF_CODES } from '@/lib/validation/br'
import { saveMyProfileAction } from '../actions'
import {
  maskCep,
  maskCpf,
  maskPhone,
  travelerProfileSchema,
  type TravelerProfileInput,
} from '../profile'

type Props = {
  initial: Omit<TravelerProfileInput, 'documentNumber'>
  email: string
  storedDocumentLabel: string | null
}

const selectClass =
  'rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-3 focus:ring-ring/20'
const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="border-border flex flex-col gap-4 border-t pt-6 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div>
        <h3 className="font-semibold">{title}</h3>
        {hint && <p className="text-muted-foreground mt-0.5 text-sm">{hint}</p>}
      </div>
      {children}
    </fieldset>
  )
}

export function TravelerProfileForm({ initial, email, storedDocumentLabel }: Props) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[] | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TravelerProfileInput>({
    resolver: zodResolver(travelerProfileSchema),
    defaultValues: { ...initial, documentNumber: '' },
  })

  const nationality = watch('nationality')
  const brazilian = nationality === 'brasileira'
  const docLabelMatches =
    storedDocumentLabel !== null &&
    (brazilian ? storedDocumentLabel.startsWith('CPF') : !storedDocumentLabel.startsWith('CPF'))

  const [cepStatus, setCepStatus] = useState<
    'idle' | 'loading' | 'found' | 'not_found' | 'unavailable'
  >('idle')

  async function onCepChange(e: ChangeEvent<HTMLInputElement>) {
    const value = maskCep(e.target.value)
    setValue('cep', value, { shouldValidate: Boolean(errors.cep) })
    const digitsOnly = value.replace(/\D/g, '')
    if (digitsOnly.length !== 8) {
      setCepStatus('idle')
      return
    }
    setCepStatus('loading')
    try {
      const res = await fetch(`/api/cep/${digitsOnly}`)
      if (res.status === 404) {
        setCepStatus('not_found')
        return
      }
      if (!res.ok) {
        setCepStatus('unavailable')
        return
      }
      const data = (await res.json()) as {
        street: string
        district: string
        city: string
        state: string
      }
      const opts = { shouldValidate: true, shouldDirty: true }
      if (data.street) setValue('street', data.street, opts)
      if (data.district) setValue('district', data.district, opts)
      if (data.city) setValue('city', data.city, opts)
      if (data.state) setValue('state', data.state, opts)
      setCepStatus('found')
      document.getElementById('addressNumber')?.focus()
    } catch {
      setCepStatus('unavailable')
    }
  }

  useEffect(() => {
    setValue('hasStoredDocument', docLabelMatches)
  }, [docLabelMatches, setValue])

  const masked =
    (
      field: 'phone' | 'whatsapp' | 'emergencyPhone' | 'cep' | 'documentNumber',
      mask: (v: string) => string,
    ) =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setValue(field, mask(e.target.value), { shouldValidate: Boolean(errors[field]) })

  async function onSubmit(values: TravelerProfileInput) {
    setFormError(null)
    setSaved(null)
    const result = await saveMyProfileAction({ ...values, hasStoredDocument: docLabelMatches })
    if (!result.ok) {
      setFormError(result.fieldErrors ? 'Confira os campos destacados.' : result.error)
      return
    }
    setValue('documentNumber', '')
    if (result.data.next) {
      router.push(result.data.next)
      return
    }
    setSaved(result.data.missing)
    router.refresh()
  }

  const docRegister = register('documentNumber')
  const phoneRegister = register('phone')
  const whatsRegister = register('whatsapp')
  const cepRegister = register('cep')
  const emergencyPhoneRegister = register('emergencyPhone')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <Section
        title="Dados pessoais"
        hint="Como no seu documento — vai para a ficha de hospedagem."
      >
        <Input
          label="Nome completo"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Data de nascimento"
            type="date"
            autoComplete="bday"
            max={new Date().toISOString().slice(0, 10)}
            error={errors.birthDate?.message}
            {...register('birthDate')}
          />
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Nacionalidade</span>
            <div className="flex gap-2">
              {(['brasileira', 'estrangeira'] as const).map((n) => (
                <label
                  key={n}
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium ${
                    nationality === n ? 'border-primary bg-primary/10 text-primary' : 'border-input'
                  }`}
                >
                  <input type="radio" value={n} className="sr-only" {...register('nationality')} />
                  {n === 'brasileira' ? 'Brasileira' : 'Estrangeira'}
                </label>
              ))}
            </div>
          </div>
        </div>
        <Input
          label={brazilian ? 'CPF' : 'Número do passaporte'}
          inputMode={brazilian ? 'numeric' : 'text'}
          autoComplete="off"
          placeholder={
            docLabelMatches
              ? `${storedDocumentLabel} — deixe em branco para manter`
              : brazilian
                ? '000.000.000-00'
                : 'Ex.: AB123456'
          }
          iconEnd={docLabelMatches ? <Lock className="size-4" /> : undefined}
          hint={
            docLabelMatches
              ? 'Documento salvo com criptografia. Só preencha se quiser trocar.'
              : 'Guardado com criptografia. Só a pousada em que você reservar recebe.'
          }
          error={errors.documentNumber?.message}
          {...docRegister}
          onChange={(e) => {
            if (brazilian) masked('documentNumber', maskCpf)(e)
            else void docRegister.onChange(e)
          }}
        />
      </Section>

      <Section title="Contato">
        <p className="text-muted-foreground -mt-2 text-sm">E-mail da conta: {email}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Celular"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={brazilian ? '(00) 00000-0000' : '(00) 00000-0000 ou +54 11 1234-5678'}
            hint="Usado pela pousada para falar com você sobre a estadia."
            error={errors.phone?.message}
            {...phoneRegister}
            onChange={masked('phone', maskPhone)}
          />
          <Input
            label="WhatsApp (se for outro número)"
            type="tel"
            inputMode="tel"
            placeholder="Opcional"
            error={errors.whatsapp?.message}
            {...whatsRegister}
            onChange={masked('whatsapp', maskPhone)}
          />
        </div>
      </Section>

      <Section title="Onde você mora">
        {brazilian ? (
          <>
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
                    ? 'Endereço encontrado — confira e complete o número.'
                    : cepStatus === 'unavailable'
                      ? 'Busca de CEP indisponível agora — preencha o endereço à mão.'
                      : 'Digite o CEP e preenchemos o endereço para você.'
                }
                error={cepStatus === 'not_found' ? 'CEP não encontrado.' : errors.cep?.message}
                {...cepRegister}
                onChange={onCepChange}
              />
              <Input
                label="Rua"
                autoComplete="address-line1"
                error={errors.street?.message}
                {...register('street')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_2fr]">
              <Input
                id="addressNumber"
                label="Número"
                autoComplete="address-line2"
                placeholder="Ex.: 123 ou s/n"
                error={errors.addressNumber?.message}
                {...register('addressNumber')}
              />
              <Input
                label="Complemento"
                placeholder="Opcional"
                error={errors.complement?.message}
                {...register('complement')}
              />
              <Input
                label="Bairro"
                autoComplete="address-level3"
                error={errors.district?.message}
                {...register('district')}
              />
            </div>
          </>
        ) : (
          <Input
            label="País"
            autoComplete="country-name"
            error={errors.country?.message}
            {...register('country')}
          />
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
              <label htmlFor="state" className={labelClass}>
                UF
              </label>
              <select id="state" className={selectClass} {...register('state')}>
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
      </Section>

      <Section title="Para sua estadia" hint="Opcional — ajuda a pousada a te receber melhor.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Contato de emergência"
            placeholder="Nome"
            error={errors.emergencyName?.message}
            {...register('emergencyName')}
          />
          <Input
            label="Telefone do contato"
            type="tel"
            inputMode="tel"
            placeholder="(00) 00000-0000"
            error={errors.emergencyPhone?.message}
            {...emergencyPhoneRegister}
            onChange={masked('emergencyPhone', maskPhone)}
          />
        </div>
        <Input
          label="Restrições alimentares"
          placeholder="Ex.: vegetariano, sem lactose"
          error={errors.dietaryRestrictions?.message}
          {...register('dietaryRestrictions')}
        />
        <Input
          label="Acessibilidade"
          placeholder="Ex.: preciso de quarto no térreo"
          error={errors.accessibilityNeeds?.message}
          {...register('accessibilityNeeds')}
        />
      </Section>

      <p className="bg-secondary/60 text-muted-foreground flex items-start gap-2 rounded-2xl p-4 text-xs">
        <Lock className="mt-0.5 size-4 shrink-0" />
        Seus dados ficam só na sua conta. Quando você faz uma reserva, a pousada escolhida recebe
        estes dados para a ficha de hospedagem (FNRH), exigida por lei. Nenhuma outra pousada vê.
      </p>

      {formError && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {formError}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className={`flex items-center gap-2 rounded-2xl p-4 text-sm font-medium ${
            saved.length === 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
          }`}
        >
          <CheckCircle2 className="size-5 shrink-0" />
          {saved.length === 0
            ? 'Cadastro salvo e completo. Você já pode reservar.'
            : `Salvo. Ainda falta: ${saved.join(', ')}.`}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="w-full sm:w-auto sm:self-end"
      >
        {isSubmitting
          ? 'Salvando…'
          : initial.next
            ? 'Salvar e continuar a reserva'
            : 'Salvar cadastro'}
      </Button>
    </form>
  )
}
