'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { keepValuesOnSubmit } from '@/lib/forms'
import { formatBRL } from '@/lib/format'
import { registerMovementAction } from '../actions'
import { UNIT_LABEL, qtyWithUnit } from '../labels'
import type { InventoryItem } from '../types'
import type { InventoryPermissions } from '../services/inventory.service'

type Kind = 'entrada' | 'saida' | 'perda' | 'ajuste'

const KIND_HELP: Record<Kind, string> = {
  entrada: 'Chegou mercadoria (compra, reposição).',
  saida: 'Saiu para uso da pousada (café da manhã, limpeza, quarto).',
  perda: 'Quebrou, venceu ou sumiu.',
  ajuste: 'Contou o estoque e o número real é outro.',
}

export function MovementForm({
  item,
  permissions,
  initialKind = 'entrada',
  onDone,
}: {
  item: InventoryItem
  permissions: InventoryPermissions
  initialKind?: Kind
  onDone: () => void
}) {
  const router = useRouter()
  const kinds: Kind[] = [
    'entrada',
    'saida',
    'perda',
    ...(permissions.adjust ? (['ajuste'] as Kind[]) : []),
  ]
  const [kind, setKind] = useState<Kind>(kinds.includes(initialKind) ? initialKind : 'entrada')
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState(item.unitCost != null ? String(item.unitCost) : '')
  const [createExpense, setCreateExpense] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  const qtyNum = Number(qty.replace(',', '.'))
  const costNum = Number(cost.replace(',', '.'))
  const preview =
    kind === 'ajuste'
      ? qty === ''
        ? null
        : qtyNum
      : qty === ''
        ? null
        : item.quantity + (kind === 'entrada' ? qtyNum : -qtyNum)

  async function submit(formData: FormData) {
    setError(null)
    setFieldErrors({})
    setPending(true)
    try {
      const result = await registerMovementAction({
        itemId: item.id,
        kind,
        quantity: qty.replace(',', '.'),
        unitCost: kind === 'entrada' ? cost.replace(',', '.') : '',
        note: String(formData.get('note') ?? ''),
        createExpense: kind === 'entrada' && createExpense,
      })
      if (!result.ok) {
        setError(result.fieldErrors ? 'Revise os campos destacados.' : result.error)
        setFieldErrors(result.fieldErrors ?? {})
        return
      }
      router.refresh()
      onDone()
    } catch {
      setError('Não foi possível registrar. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={keepValuesOnSubmit(submit)} className="space-y-4" noValidate>
      <p className="text-muted-foreground text-sm">
        Em estoque agora:{' '}
        <strong className="text-foreground">{qtyWithUnit(item.quantity, item.unit)}</strong>
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
              kind === k
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary'
            }`}
          >
            {k === 'entrada'
              ? 'Entrada'
              : k === 'saida'
                ? 'Saída'
                : k === 'perda'
                  ? 'Perda'
                  : 'Ajuste'}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{KIND_HELP[kind]}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={
            kind === 'ajuste'
              ? `Quantidade contada (${UNIT_LABEL[item.unit]})`
              : `Quantidade (${UNIT_LABEL[item.unit]})`
          }
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          error={fieldErrors.quantity}
          autoFocus
        />
        {kind === 'entrada' && permissions.seeCosts && (
          <Input
            label="Custo por unidade (R$)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            hint="Opcional"
            error={fieldErrors.unitCost}
          />
        )}
      </div>

      {kind === 'entrada' && permissions.manage && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={createExpense}
            onChange={(e) => setCreateExpense(e.target.checked)}
          />
          <span>
            <span className="text-foreground font-medium">Lançar esta compra no Financeiro</span>
            <span className="text-muted-foreground block text-xs">
              Cria uma despesa paga (Insumos)
              {qtyNum > 0 && costNum > 0
                ? ` de ${formatBRL(Math.max(1, Math.round(qtyNum * costNum)))}`
                : ''}
              .
            </span>
          </span>
        </label>
      )}

      <Input
        label="Observação (opcional)"
        name="note"
        maxLength={200}
        placeholder="Ex.: NF 1234, fornecedor X"
      />

      {preview !== null && Number.isFinite(preview) && (
        <p className={`text-sm ${preview < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {preview < 0
            ? 'Não há quantidade suficiente para essa saída.'
            : `Fica com ${qtyWithUnit(preview, item.unit)}.`}
        </p>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || (preview !== null && preview < 0)}>
          {pending ? 'Registrando…' : 'Registrar'}
        </Button>
      </div>
    </form>
  )
}
