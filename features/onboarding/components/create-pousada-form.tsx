'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import '@/lib/validation/zod-pt'
import { useRouter } from 'next/navigation'
import { createPousadaSchema, type CreatePousadaInput } from '../schemas'
import { createPousadaAction } from '../actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function CreatePousadaForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePousadaInput>({
    resolver: zodResolver(createPousadaSchema),
    defaultValues: { name: '', city: '', state: '', description: '' },
  })

  async function onSubmit(values: CreatePousadaInput) {
    setFormError(null)
    const result = await createPousadaAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    router.push(result.data.redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Input
        label="Nome da pousada"
        placeholder="Ex.: Refúgio das Nuvens"
        error={errors.name?.message}
        {...register('name')}
      />
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Input
          label="Cidade"
          placeholder="Ex.: Monte Verde"
          error={errors.city?.message}
          {...register('city')}
        />
        <Input
          label="UF"
          placeholder="MG"
          maxLength={2}
          className="w-20 uppercase"
          error={errors.state?.message}
          {...register('state')}
        />
      </div>
      <Input
        label="Diária (R$)"
        type="number"
        min={1}
        placeholder="720"
        error={errors.pricePerNight?.message}
        {...register('pricePerNight')}
      />
      <Textarea
        label="Descrição"
        rows={5}
        placeholder="Conte a história e os diferenciais da sua pousada…"
        error={errors.description?.message}
        {...register('description')}
      />
      {formError && <p className="text-destructive text-sm font-medium">{formError}</p>}
      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Enviando…' : 'Enviar para análise'}
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        Sua pousada passará por uma curadoria antes de ficar visível no site.
      </p>
    </form>
  )
}
