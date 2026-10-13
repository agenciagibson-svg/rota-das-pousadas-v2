'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CircleDollarSign, CreditCard, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createPlatformExpenseAction,
  setPlatformExpensePaidAction,
  bootstrapPlatformPlanAction,
} from '../actions'
import type { PlatformExpense, PlatformExpenseCategory } from '../types'

const CATEGORY_LABEL: Record<PlatformExpenseCategory, string> = {
  infraestrutura: 'Infraestrutura',
  pessoal: 'Pessoal',
  marketing: 'Marketing',
  impostos: 'Impostos',
  juridico: 'Jurídico',
  outros: 'Outros',
}
const CATEGORY_OPTIONS: PlatformExpenseCategory[] = [
  'infraestrutura',
  'pessoal',
  'marketing',
  'impostos',
  'juridico',
  'outros',
]

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR')}`
}

/** Preço de assinatura tem centavos (R$59,90) — sempre 2 casas, diferente de `formatCurrency` (reais inteiros das despesas). */
function formatPlanPrice(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'sem vencimento'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00`))
}

/**
 * Financeiro do painel master — primeira peça (contas a pagar da própria
 * Rota), achado da análise de 19/09/2026: não havia lugar nenhum pra
 * registrar as despesas da empresa. Contas a receber/fluxo de caixa entram
 * aqui depois, quando o motor de cobrança de assinatura existir.
 */
export function PlatformFinance({
  initialExpenses,
  planStatus,
}: {
  initialExpenses: PlatformExpense[]
  planStatus: { name: string; price: number; configured: boolean } | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [payingId, setPayingId] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<PlatformExpenseCategory>('outros')
  const [dueDate, setDueDate] = useState('')

  function bootstrapPlan() {
    setError(null)
    setBootstrapping(true)
    startTransition(async () => {
      const result = await bootstrapPlatformPlanAction({})
      setBootstrapping(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  const openCount = initialExpenses.filter((e) => !e.paid).length
  const openTotal = initialExpenses.filter((e) => !e.paid).reduce((sum, e) => sum + e.amount, 0)

  function addExpense() {
    setError(null)
    startTransition(async () => {
      const result = await createPlatformExpenseAction({
        description,
        amount: Number(amount),
        category,
        dueDate: dueDate || undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDescription('')
      setAmount('')
      setCategory('outros')
      setDueDate('')
      router.refresh()
    })
  }

  function togglePaid(expense: PlatformExpense) {
    setError(null)
    setPayingId(expense.id)
    startTransition(async () => {
      const result = await setPlatformExpensePaidAction({
        expenseId: expense.id,
        paid: !expense.paid,
      })
      setPayingId(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {planStatus && (
        <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="text-ocean size-5" />
            <span className="text-muted-foreground text-sm">
              Assinatura das pousadas: plano {planStatus.name} · {formatPlanPrice(planStatus.price)}
              /mês ·{' '}
              {planStatus.configured ? 'configurado no Mercado Pago' : 'ainda não configurado'}
            </span>
          </div>
          {!planStatus.configured && (
            <Button size="sm" variant="outline" disabled={bootstrapping} onClick={bootstrapPlan}>
              {bootstrapping ? 'Configurando…' : 'Configurar cobrança'}
            </Button>
          )}
        </div>
      )}

      <div className="border-border flex flex-wrap items-center gap-2 rounded-2xl border p-4">
        <CircleDollarSign className="text-ocean size-5" />
        <span className="text-muted-foreground text-sm">
          {openCount} conta(s) em aberto — {formatCurrency(openTotal)} a pagar
        </span>
      </div>

      <div className="border-border rounded-2xl border p-4">
        <h3 className="text-foreground flex items-center gap-1.5 font-semibold">
          <Plus className="text-ocean size-4" />
          Nova conta a pagar
        </h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Input
            label="Descrição"
            placeholder="Ex.: Hospedagem Vercel"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-56"
            disabled={isPending}
          />
          <Input
            label="Valor (R$)"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32"
            disabled={isPending}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-foreground text-sm font-medium">Categoria</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PlatformExpenseCategory)}
              disabled={isPending}
              className="border-input bg-card text-foreground focus:border-ring h-10 rounded-xl border px-3 text-sm outline-none"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Vencimento"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={isPending}
          />
          <Button
            type="button"
            disabled={isPending || !description || !amount}
            onClick={addExpense}
          >
            {isPending && !payingId ? 'Salvando…' : 'Lançar'}
          </Button>
        </div>
      </div>

      {initialExpenses.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma despesa lançada ainda.</p>
      ) : (
        <div className="space-y-2">
          {initialExpenses.map((expense) => (
            <div
              key={expense.id}
              className="bg-secondary/50 flex items-center justify-between gap-3 rounded-xl p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-foreground truncate font-medium">
                    {expense.description}
                  </span>
                  <span className="bg-ocean/10 text-ocean inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    {CATEGORY_LABEL[expense.category]}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {formatCurrency(expense.amount)} · vence {fmtDate(expense.dueDate)}
                </p>
              </div>
              <button
                type="button"
                disabled={isPending && payingId === expense.id}
                onClick={() => togglePaid(expense)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  expense.paid
                    ? 'border-border text-muted-foreground hover:bg-secondary'
                    : 'border-ocean/30 text-ocean hover:bg-ocean/10'
                }`}
              >
                <CheckCircle2 className="size-3.5" />
                {isPending && payingId === expense.id
                  ? 'Salvando…'
                  : expense.paid
                    ? 'Reabrir'
                    : 'Marcar como paga'}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
    </div>
  )
}
