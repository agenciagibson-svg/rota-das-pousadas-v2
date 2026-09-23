'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addBookingChargeAction } from '../../actions'
import { addChargeSchema, type AddChargeInput } from '../../folio-schemas'

/** Um lançamento por pedido: descrição, quantidade e valor unitário. */
export function AddChargeForm({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddChargeInput>({
    resolver: zodResolver(addChargeSchema),
    defaultValues: { bookingId, description: '', quantity: 1, unitPrice: undefined },
  })

  async function onSubmit(values: AddChargeInput) {
    setFormError(null)
    const result = await addBookingChargeAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    reset({ bookingId, description: '', quantity: 1, unitPrice: undefined })
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <Input
        label="Pedido"
        placeholder="Ex.: Água mineral"
        error={errors.description?.message}
        {...register('description')}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Quantidade"
          type="number"
          min={1}
          step={1}
          error={errors.quantity?.message}
          {...register('quantity')}
        />
        <Input
          label="Valor unitário (R$)"
          type="number"
          min={0.01}
          step={0.01}
          placeholder="0,00"
          error={errors.unitPrice?.message}
          {...register('unitPrice')}
        />
      </div>
      {formError && <p className="text-destructive text-sm font-medium">{formError}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={isSubmitting}>
        <Plus className="size-4" />
        {isSubmitting ? 'Lançando…' : 'Lançar consumo'}
      </Button>
    </form>
  )
}
