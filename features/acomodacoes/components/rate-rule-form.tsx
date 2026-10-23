'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/format'
import { SAVE_FAILED_MESSAGE, formErrorMessage } from '@/lib/forms'
import { createRateRuleAction, updateRateRuleAction } from '../actions'
import { WEEKDAY_LABELS, previewNightly } from '../rates'
import type { RateRule } from '../types'

const VISIBLE_FIELDS = ['name', 'roomId', 'firstNight', 'lastNight', 'value', 'minNights']

const selectClass =
  'border-input bg-card text-foreground focus:border-ring aria-invalid:border-destructive min-h-12 rounded-2xl border px-4 text-sm outline-none'

export function RateRuleForm({
  rule,
  rooms,
  onDone,
}: {
  rule?: RateRule
  rooms: { id: string; name: string; basePrice?: number }[]
  onDone: () => void
}) {
  const router = useRouter()
  const [kind, setKind] = useState<'fixed' | 'percent'>(rule?.kind ?? 'percent')
  const [value, setValue] = useState(rule ? String(rule.value) : '')
  const [roomId, setRoomId] = useState(rule?.roomId ?? '')
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays ?? [])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  const sample = rooms.find((r) => r.id === roomId) ?? rooms.find((r) => r.basePrice !== undefined)
  const numericValue = Number(value.replace(',', '.'))
  const preview =
    sample?.basePrice !== undefined && value !== '' && Number.isFinite(numericValue)
      ? previewNightly(sample.basePrice, { kind, value: numericValue })
      : null

  function toggleDay(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  // onSubmit (não `action`): o React 19 limpa o formulário depois de um `action`.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setFieldErrors({})
    setPending(true)
    const payload = {
      name: String(form.get('name') ?? ''),
      roomId,
      firstNight: String(form.get('firstNight') ?? ''),
      lastNight: String(form.get('lastNight') ?? ''),
      weekdays,
      kind,
      value: numericValue,
      minNights: form.get('minNights') ? Number(form.get('minNights')) : undefined,
      active: form.get('active') === 'on',
    }
    try {
      const result = rule
        ? await updateRateRuleAction({ ...payload, id: rule.id })
        : await createRateRuleAction(payload)
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
        label="Nome da regra"
        name="name"
        defaultValue={rule?.name}
        placeholder="Ex.: Carnaval, Réveillon, Fim de semana"
        error={fieldErrors.name}
        required
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-foreground text-sm font-medium">Vale para</span>
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={selectClass}>
          <option value="">Todas as acomodações</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Primeira noite"
          name="firstNight"
          type="date"
          defaultValue={rule?.firstNight}
          error={fieldErrors.firstNight}
          required
        />
        <Input
          label="Última noite"
          name="lastNight"
          type="date"
          defaultValue={rule?.lastNight}
          error={fieldErrors.lastNight}
          hint="A noite da última data também entra."
          required
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-medium">Dias da semana da noite</legend>
        <p className="text-muted-foreground text-xs">
          Nenhum marcado = todos os dias. Fim de semana: marque Sex e Sáb.
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, day) => (
            <Button
              key={label}
              type="button"
              size="touch"
              variant={weekdays.includes(day) ? 'default' : 'outline'}
              aria-pressed={weekdays.includes(day)}
              onClick={() => toggleDay(day)}
            >
              {label}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-medium">Como muda a diária</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['percent', 'Percentual'],
              ['fixed', 'Valor fixo'],
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
          label={
            kind === 'percent' ? 'Percentual sobre a diária (use − para desconto)' : 'Diária (R$)'
          }
          name="value"
          inputMode={kind === 'percent' ? 'text' : 'numeric'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={kind === 'percent' ? 'Ex.: 30 ou -10' : 'Ex.: 650'}
          error={fieldErrors.value}
          required
        />
        {preview !== null && sample?.basePrice !== undefined && (
          <p className={cn('text-muted-foreground text-sm')} aria-live="polite">
            Exemplo: {sample.name} de {formatBRL(sample.basePrice)} passa a{' '}
            <strong className="text-foreground">{formatBRL(preview)}</strong> por noite.
          </p>
        )}
      </fieldset>

      <Input
        label="Estadia mínima (noites, opcional)"
        name="minNights"
        type="number"
        inputMode="numeric"
        min={1}
        max={30}
        defaultValue={rule?.minNights ?? ''}
        hint="Vale para qualquer reserva que inclua uma noite deste período."
        error={fieldErrors.minNights}
      />
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={rule?.active ?? true}
          className="size-5"
        />
        Regra ativa
      </label>

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
          {pending ? 'Salvando…' : 'Salvar regra'}
        </Button>
      </div>
    </form>
  )
}
