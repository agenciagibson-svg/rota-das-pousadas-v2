'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createExpenseSchema, type CreateExpenseInput } from '../schemas'
import { createExpenseAction } from '../actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CATEGORIES: { value: CreateExpenseInput['category']; label: string }[] = [
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'insumos', label: 'Insumos' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'outros', label: 'Outros' },
]

export function ExpenseForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: { description: '', amount: 0, category: 'outros', dueDate: '' },
  })

  async function onSubmit(values: CreateExpenseInput) {
    setFormError(null)
    const result = await createExpenseAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    reset()
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <Input label="Descrição" placeholder="Ex.: Conta de energia" error={errors.description?.message} {...register('description')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor (R$)" type="number" min={1} placeholder="0" error={errors.amount?.message} {...register('amount')} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Categoria
          </label>
          <select
            id="category"
            className={cn(
              'rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/20',
            )}
            {...register('category')}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Input label="Vencimento (opcional)" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
      {formError && <p className="text-sm font-medium text-destructive">{formError}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Lançando…' : 'Lançar despesa'}
      </Button>
    </form>
  )
}
