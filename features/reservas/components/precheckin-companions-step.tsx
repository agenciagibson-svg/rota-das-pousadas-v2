'use client'

import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { maskCpf } from '@/features/auth/profile'
import {
  COMPANION_DOCUMENT_TYPES,
  COMPANION_TYPE_LABEL,
  COMPANION_TYPES,
  companionLimitError,
  type CompanionLimits,
  type PrecheckinInput,
  type StoredCompanionDocuments,
} from '../precheckin'

const selectClass =
  'border-input bg-card focus:border-foreground focus:ring-ipe/60 min-h-12 rounded-2xl border px-4 text-sm outline-none focus:ring-2'

/** Bloco "Quem vai com você": adicionar/remover acompanhantes. */
export function PrecheckinCompanionsStep({
  form,
  limits,
  storedDocuments,
}: {
  form: UseFormReturn<PrecheckinInput>
  limits: CompanionLimits
  storedDocuments: StoredCompanionDocuments
}) {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'companions' })
  const companions = watch('companions')
  const limitError = companionLimitError(companions, limits)
  const atLimit =
    companions.filter((c) => c.guestType !== 'infant').length >= limits.maxCompanions &&
    companions.length - companions.filter((c) => c.guestType !== 'infant').length >=
      limits.maxInfants

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {limits.maxCompanions === 0
          ? 'Sua reserva é para uma pessoa. Se for levar um bebê, adicione aqui.'
          : `Cabem mais ${limits.maxCompanions} ${limits.maxCompanions === 1 ? 'pessoa' : 'pessoas'} além de você. Bebê de colo não conta.`}
      </p>

      {fields.length === 0 && (
        <p className="bg-secondary/60 text-muted-foreground rounded-2xl p-4 text-sm">
          Ninguém adicionado. Se você vai sozinho, é só seguir.
        </p>
      )}

      {fields.map((field, index) => {
        const type = companions[index]?.guestType ?? 'adult'
        const docType = companions[index]?.documentType ?? ''
        const keep = companions[index]?.keepDocumentOf ?? ''
        const stored = keep ? storedDocuments[keep] : undefined
        const err = errors.companions?.[index]
        const docRegister = register(`companions.${index}.documentNumber`)
        return (
          <Card key={field.id} className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-foreground text-sm font-semibold">Acompanhante {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="pill"
                onClick={() => remove(index)}
                aria-label={`Remover acompanhante ${index + 1}`}
              >
                <Trash2 className="size-4" />
                Remover
              </Button>
            </div>

            <Input
              label="Nome completo"
              autoComplete="off"
              error={err?.fullName?.message}
              {...register(`companions.${index}.fullName`)}
            />

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-foreground mb-1.5 text-sm font-medium">Tipo</legend>
              <div className="grid grid-cols-3 gap-2">
                {COMPANION_TYPES.map((t) => (
                  <label
                    key={t}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border px-3 text-sm font-medium',
                      type === t ? 'border-primary bg-primary/10 text-primary' : 'border-input',
                    )}
                  >
                    <input
                      type="radio"
                      value={t}
                      className="sr-only"
                      {...register(`companions.${index}.guestType`)}
                    />
                    {COMPANION_TYPE_LABEL[t]}
                  </label>
                ))}
              </div>
            </fieldset>

            <Input
              label={type === 'adult' ? 'Data de nascimento' : 'Data de nascimento (opcional)'}
              type="date"
              error={err?.birthDate?.message}
              {...register(`companions.${index}.birthDate`)}
            />

            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`companions-${index}-documentType`}
                  className="text-foreground text-sm font-medium"
                >
                  Documento{type === 'adult' ? '' : ' (opcional)'}
                </label>
                <select
                  id={`companions-${index}-documentType`}
                  className={selectClass}
                  aria-invalid={err?.documentType ? true : undefined}
                  {...register(`companions.${index}.documentType`)}
                >
                  <option value="">{stored ? 'Manter o salvo' : 'Selecione'}</option>
                  {COMPANION_DOCUMENT_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {err?.documentType?.message && (
                  <p className="text-destructive text-xs">{err.documentType.message}</p>
                )}
              </div>
              <Input
                id={`companions-${index}-documentNumber`}
                label="Número"
                inputMode={docType === 'CPF' ? 'numeric' : 'text'}
                autoComplete="off"
                placeholder={stored ? `${stored} salvo — deixe em branco para manter` : undefined}
                iconEnd={stored ? <Lock className="size-4" /> : undefined}
                error={err?.documentNumber?.message}
                {...docRegister}
                onChange={(e) => {
                  if (docType === 'CPF') {
                    setValue(`companions.${index}.documentNumber`, maskCpf(e.target.value), {
                      shouldValidate: Boolean(err?.documentNumber),
                    })
                  } else {
                    void docRegister.onChange(e)
                  }
                }}
              />
            </div>
          </Card>
        )
      })}

      {limitError && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {limitError}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="pill"
        className="self-start"
        disabled={atLimit || fields.length >= 20}
        onClick={() =>
          append({
            keepDocumentOf: '',
            fullName: '',
            guestType: limits.maxCompanions > 0 ? 'adult' : 'infant',
            birthDate: '',
            documentType: '',
            documentNumber: '',
          })
        }
      >
        <Plus className="size-4" />
        Adicionar acompanhante
      </Button>
    </div>
  )
}
