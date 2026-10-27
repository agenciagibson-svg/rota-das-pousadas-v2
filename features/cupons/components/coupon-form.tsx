'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SAVE_FAILED_MESSAGE, formErrorMessage } from '@/lib/forms'
import { createCouponAction } from '../actions'
import { couponValueLabel, normalizeCouponCode } from '../discount'
import type { CouponKind } from '../types'

const VISIBLE_FIELDS = [
  'code',
  'value',
  'validFrom',
  'validUntil',
  'stayFrom',
  'stayUntil',
  'minNights',
  'maxUses',
]

const optionalNumber = (v: FormDataEntryValue | null) => (v ? Number(v) : undefined)
const text = (v: FormDataEntryValue | null) => String(v ?? '')

/** Novo cupom (0100). O banco repete todas as checagens. */
export function CouponForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [kind, setKind] = useState<CouponKind>('percent')
  const [code, setCode] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  const numericValue = Number(value)
  const showPreview = code.length >= 3 && Number.isInteger(numericValue) && numericValue > 0

  // onSubmit (não `action`): o React 19 limpa o formulário depois de um `action`.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setFieldErrors({})
    setPending(true)
    try {
      const result = await createCouponAction({
        code,
        kind,
        value: numericValue,
        validFrom: text(form.get('validFrom')),
        validUntil: text(form.get('validUntil')),
        stayFrom: text(form.get('stayFrom')),
        stayUntil: text(form.get('stayUntil')),
        minNights: optionalNumber(form.get('minNights')),
        maxUses: optionalNumber(form.get('maxUses')),
      })
      if (!result.ok) {
        const errors = result.fieldErrors ?? {}
        setFieldErrors(errors)
        setError(formErrorMessage(result.error, errors, VISIBLE_FIELDS))
        return
      }
      router.refresh()
      onDone()
    } catch {
      setError(SAVE_FAILED_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        label="Código"
        name="code"
        value={code}
        onChange={(e) => setCode(normalizeCouponCode(e.target.value).replace(/[^A-Z0-9]/g, ''))}
        maxLength={20}
        autoComplete="off"
        placeholder="Ex.: DIRETO10"
        hint="De 3 a 20 letras ou números. O hóspede pode digitar em minúsculas."
        error={fieldErrors.code}
        required
      />

      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-medium">Desconto</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['percent', 'Percentual'],
              ['fixed', 'Valor em R$'],
            ] as const
          ).map(([k, label]) => (
            <Button
              key={k}
              type="button"
              size="touch"
              variant={kind === k ? 'default' : 'outline'}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Input
          label={kind === 'percent' ? 'Percentual (1 a 90)' : 'Valor do desconto (R$)'}
          name="value"
          type="number"
          inputMode="numeric"
          min={1}
          max={kind === 'percent' ? 90 : 100000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={kind === 'percent' ? 'Ex.: 10' : 'Ex.: 50'}
          hint={
            kind === 'fixed'
              ? 'Vale só para estadias que custem mais do que o desconto.'
              : 'Arredondado para o real mais próximo.'
          }
          error={fieldErrors.value}
          required
        />
        {showPreview && (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            Na bio vai aparecer: use o cupom <strong className="text-foreground">{code}</strong> e
            ganhe{' '}
            <strong className="text-foreground">{couponValueLabel(kind, numericValue)}</strong> de
            desconto.
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-medium">Quando pode ser usado</legend>
        <p className="text-muted-foreground text-xs">
          Datas em que o hóspede faz a reserva. Em branco = sem limite.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="A partir de" name="validFrom" type="date" error={fieldErrors.validFrom} />
          <Input label="Até" name="validUntil" type="date" error={fieldErrors.validUntil} />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-medium">
          Só para estadias entre (opcional)
        </legend>
        <p className="text-muted-foreground text-xs">
          A entrada não pode ser antes da primeira data, e a saída não pode ser depois da segunda.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Entrada a partir de"
            name="stayFrom"
            type="date"
            error={fieldErrors.stayFrom}
          />
          <Input label="Saída até" name="stayUntil" type="date" error={fieldErrors.stayUntil} />
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Estadia mínima (noites)"
          name="minNights"
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          hint="Opcional."
          error={fieldErrors.minNights}
        />
        <Input
          label="Limite de usos"
          name="maxUses"
          type="number"
          inputMode="numeric"
          min={1}
          hint="Opcional. Cada hóspede usa uma vez."
          error={fieldErrors.maxUses}
        />
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="touch" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" size="touch" disabled={pending}>
          {pending ? 'Salvando…' : 'Criar cupom'}
        </Button>
      </div>
    </form>
  )
}
