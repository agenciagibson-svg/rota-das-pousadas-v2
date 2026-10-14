'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import '@/lib/validation/zod-pt'
import { useRouter } from 'next/navigation'
import { destinationInputSchema, type DestinationFormInput } from '../schemas'
import { createDestinationAction, updateDestinationAction } from '../actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/ui/image-upload'
import type { AdminDestinationRow } from '../types'
import { slugify } from '@/lib/slug'

const SEASON_LABEL: Record<string, string> = {
  verao: 'Verão',
  outono: 'Outono',
  inverno: 'Inverno',
  primavera: 'Primavera',
}
const SEASON_OPTIONS = ['verao', 'outono', 'inverno', 'primavera'] as const

/**
 * Formulário de criar/editar destino. Slug é sugerido a partir do nome
 * (slugify puro, sem sufixo aleatório — diferente de `uniqueSlug`, que as
 * pousadas usam: nome de destino deve ser único, então um slug limpo tipo
 * "gramado" é o esperado), mas fica editável — a equipe pode ajustar antes
 * de salvar. Depois do primeiro edit manual do slug, o auto-preenchimento
 * pelo nome para.
 */
export function DestinationForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: AdminDestinationRow
  onDone: () => void
  onCancel: () => void
}) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DestinationFormInput>({
    resolver: zodResolver(destinationInputSchema),
    defaultValues: initial
      ? {
          slug: initial.slug,
          name: initial.name,
          state: initial.state,
          image: initial.image,
          season: initial.season,
          rating: initial.rating,
          priceFrom: initial.priceFrom,
        }
      : {
          slug: '',
          name: '',
          state: '',
          image: '',
          season: [],
          rating: 0,
          priceFrom: 0,
        },
  })

  async function onSubmit(values: DestinationFormInput) {
    setFormError(null)
    const result = initial
      ? await updateDestinationAction({ id: initial.id, ...values })
      : await createDestinationAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    router.refresh()
    onDone()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border-border flex flex-col gap-4 rounded-2xl border p-4"
      noValidate
    >
      <Controller
        control={control}
        name="image"
        render={({ field }) => (
          <ImageUpload
            label="Foto de capa"
            max={1}
            value={field.value ? [field.value] : []}
            onChange={(urls) => field.onChange(urls[0] ?? '')}
            error={errors.image?.message}
          />
        )}
      />

      <Input
        label="Nome do destino"
        placeholder="Ex.: Gramado"
        error={errors.name?.message}
        {...register('name', {
          onChange: (e) => {
            if (!slugTouched) setValue('slug', slugify(e.target.value))
          },
        })}
      />

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Input
          label="Slug (URL)"
          placeholder="gramado"
          error={errors.slug?.message}
          {...register('slug', { onChange: () => setSlugTouched(true) })}
        />
        <Input
          label="UF"
          placeholder="RS"
          maxLength={2}
          className="w-20 uppercase"
          error={errors.state?.message}
          {...register('state')}
        />
      </div>

      <div>
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Estações em destaque
        </span>
        <div className="mt-1.5 flex flex-wrap gap-3">
          {SEASON_OPTIONS.map((season) => (
            <label key={season} className="text-foreground flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="border-input size-4 rounded"
                value={season}
                {...register('season')}
              />
              {SEASON_LABEL[season]}
            </label>
          ))}
        </div>
        {errors.season && <p className="text-destructive mt-1 text-xs">{errors.season.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Nota de destaque (0-5)"
          type="number"
          step="0.1"
          min={0}
          max={5}
          error={errors.rating?.message}
          {...register('rating')}
        />
        <Input
          label="A partir de (R$)"
          type="number"
          min={0}
          error={errors.priceFrom?.message}
          {...register('priceFrom')}
        />
      </div>

      {formError && <p className="text-destructive text-sm font-medium">{formError}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : initial ? 'Salvar alterações' : 'Criar destino'}
        </Button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onCancel}
          className="text-muted-foreground text-sm hover:underline disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
