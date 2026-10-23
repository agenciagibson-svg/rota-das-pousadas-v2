'use client'

import { useEffect, useState } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import '@/lib/validation/zod-pt'
import { CheckCircle2, ChevronLeft, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { submitPrecheckinAction } from '../actions'
import {
  companionLimitError,
  precheckinSchema,
  type CompanionLimits,
  type PrecheckinInput,
  type StoredCompanionDocuments,
} from '../precheckin'
import { PrecheckinGuestStep } from './precheckin-guest-step'
import { PrecheckinCompanionsStep } from './precheckin-companions-step'

const STEPS = ['Seus dados', 'Quem vai com você', 'Chegada'] as const

/** Campos validados ao avançar de cada passo. */
const STEP_FIELDS: FieldPath<PrecheckinInput>[][] = [
  [
    'nationality',
    'birthDate',
    'phone',
    'documentNumber',
    'cep',
    'address',
    'city',
    'state',
    'country',
  ],
  ['companions'],
  ['expectedArrivalTime'],
]

/** Primeiro passo com erro (para voltar a ele quando o servidor recusar um campo). */
function stepOfField(key: string): number {
  if (key.startsWith('companions')) return 1
  if (key === 'expectedArrivalTime') return 2
  return 0
}

export function PrecheckinForm({
  initial,
  fullName,
  storedDocument,
  storedCompanionDocuments,
  limits,
  checkinTime,
}: {
  initial: PrecheckinInput
  fullName: string
  /** Documento já na ficha do responsável: tipo ("CPF"/"Passaporte") e rótulo mascarado. */
  storedDocument: { type: string; label: string } | null
  storedCompanionDocuments: StoredCompanionDocuments
  limits: CompanionLimits
  checkinTime: string
}) {
  const [step, setStep] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const form = useForm<PrecheckinInput>({
    resolver: zodResolver(precheckinSchema),
    defaultValues: initial,
    mode: 'onTouched',
  })
  const { handleSubmit, trigger, watch, setValue, setError, register, formState } = form

  const nationality = watch('nationality')
  const storedMatches =
    storedDocument !== null &&
    (nationality === 'brasileira'
      ? storedDocument.type.toUpperCase() === 'CPF'
      : storedDocument.type.toUpperCase() !== 'CPF')
  useEffect(() => {
    setValue('hasStoredDocument', storedMatches)
  }, [storedMatches, setValue])

  async function next() {
    setFormError(null)
    const valid = await trigger(STEP_FIELDS[step])
    if (!valid) return
    if (step === 1) {
      const limit = companionLimitError(form.getValues('companions'), limits)
      if (limit) return setFormError(limit)
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  async function onSubmit(values: PrecheckinInput) {
    setFormError(null)
    const result = await submitPrecheckinAction({ ...values, hasStoredDocument: storedMatches })
    if (!result.ok) {
      const fields = Object.entries(result.fieldErrors ?? {})
      for (const [key, message] of fields) {
        setError(key as FieldPath<PrecheckinInput>, { message })
      }
      if (fields.length > 0) setStep(Math.min(...fields.map(([key]) => stepOfField(key))))
      setFormError(fields.length > 0 ? 'Confira os campos destacados.' : result.error)
      return
    }
    setSent(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="text-success size-12" />
        <h2 className="text-h2 text-foreground">Ficha enviada.</h2>
        <p className="text-muted-foreground max-w-md">Na chegada é só confirmar com a recepção.</p>
      </div>
    )
  }

  const last = step === STEPS.length - 1

  return (
    <form
      onSubmit={(e) => {
        // Enter num campo de passo intermediário avança, não envia.
        if (!last) {
          e.preventDefault()
          void next()
          return
        }
        void handleSubmit(onSubmit, (errs) => {
          const keys = Object.keys(errs)
          if (keys.length > 0) setStep(Math.min(...keys.map(stepOfField)))
        })(e)
      }}
      className="flex flex-col gap-6"
      noValidate
    >
      <ol className="grid grid-cols-3 gap-2" aria-label="Etapas da ficha">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'border-t-4 pt-2 text-xs font-medium',
              i <= step ? 'border-primary text-foreground' : 'border-border text-muted-foreground',
            )}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-h3 text-foreground mb-4">{STEPS[step]}</legend>
        {step === 0 && (
          <PrecheckinGuestStep
            form={form}
            fullName={fullName}
            storedDocumentLabel={storedMatches ? (storedDocument?.label ?? null) : null}
          />
        )}
        {step === 1 && (
          <PrecheckinCompanionsStep
            form={form}
            limits={limits}
            storedDocuments={storedCompanionDocuments}
          />
        )}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Input
              label="Horário previsto de chegada (opcional)"
              type="time"
              step={900}
              hint={`O check-in começa às ${checkinTime}. Ajuda a recepção a te esperar.`}
              error={formState.errors.expectedArrivalTime?.message}
              {...register('expectedArrivalTime')}
            />
            <p className="bg-secondary/60 text-muted-foreground flex items-start gap-2 rounded-2xl p-4 text-xs">
              <Lock className="mt-0.5 size-4 shrink-0" />
              Estes dados vão só para a pousada da sua reserva, para a ficha de hospedagem (FNRH)
              exigida por lei. Documentos ficam guardados com criptografia.
            </p>
          </div>
        )}
      </fieldset>

      {formError && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="pill"
            onClick={() => {
              setFormError(null)
              setStep((s) => s - 1)
            }}
          >
            <ChevronLeft className="size-4" />
            Voltar
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="pill" disabled={formState.isSubmitting}>
          {last ? (formState.isSubmitting ? 'Enviando…' : 'Enviar ficha') : 'Continuar'}
        </Button>
      </div>
    </form>
  )
}
