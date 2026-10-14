'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createRoomAction, updateRoomAction } from '../actions'
import type { ManagedRoom, AccommodationCategory, BedType } from '../types'
import { SAVE_FAILED_MESSAGE, formErrorMessage, keepValuesOnSubmit } from '@/lib/forms'

const BED_TYPES: { value: BedType; label: string }[] = [
  { value: 'casal', label: 'Casal' },
  { value: 'queen', label: 'Queen' },
  { value: 'king', label: 'King' },
  { value: 'solteiro', label: 'Solteiro' },
  { value: 'beliche', label: 'Beliche' },
  { value: 'sofa_cama', label: 'Sofá-cama' },
  { value: 'berco', label: 'Berço' },
]

/** Campos com lugar na tela para mostrar o erro; o resto vai para a mensagem geral. */
const VISIBLE_FIELDS = [
  ...BED_TYPES.map((b) => `bed_${b.value}`),
  'name',
  'code',
  'categoryId',
  'location',
  'capacity',
  'capacityMax',
  'adultsMax',
  'childrenMax',
  'basePrice',
  'displayOrder',
  'description',
  'operationalDescription',
  'internalNotes',
]

export function RoomForm({
  room,
  categories,
  amenities,
  onDone,
}: {
  room?: ManagedRoom
  categories: AccommodationCategory[]
  amenities: { id: string; name: string }[]
  onDone: () => void
}) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isPending, setPending] = useState(false)
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(room?.amenityIds ?? [])

  function toggleAmenity(id: string) {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    )
  }

  async function onSubmit(formData: FormData) {
    setFormError(null)
    setFieldErrors({})
    setPending(true)

    const bedConfig = BED_TYPES.map((b) => ({
      type: b.value,
      quantity: Number(formData.get(`bed_${b.value}`) ?? 0),
    })).filter((b) => b.quantity > 0)

    const payload = {
      name: String(formData.get('name') ?? ''),
      code: String(formData.get('code') ?? ''),
      categoryId: String(formData.get('categoryId') ?? ''),
      description: String(formData.get('description') ?? ''),
      operationalDescription: String(formData.get('operationalDescription') ?? ''),
      location: String(formData.get('location') ?? ''),
      capacity: Number(formData.get('capacity') ?? 1),
      capacityMax: formData.get('capacityMax') ? Number(formData.get('capacityMax')) : undefined,
      adultsMax: formData.get('adultsMax') ? Number(formData.get('adultsMax')) : undefined,
      childrenMax: Number(formData.get('childrenMax') ?? 0),
      infantsAllowed: formData.get('infantsAllowed') === 'on',
      petsAllowed: formData.get('petsAllowed') === 'on',
      bedConfig,
      accessible: formData.get('accessible') === 'on',
      basePrice: Number(formData.get('basePrice') ?? 0),
      publicVisible: formData.get('publicVisible') === 'on',
      displayOrder: Number(formData.get('displayOrder') ?? 0),
      internalNotes: String(formData.get('internalNotes') ?? ''),
      amenityIds: selectedAmenities,
    }

    // try/finally: se a action lançar (queda de rede), o botão não fica travado.
    try {
      const result = room
        ? await updateRoomAction({ ...payload, id: room.id })
        : await createRoomAction(payload)
      if (!result.ok) {
        const errors: Record<string, string> = {}
        for (const [key, msg] of Object.entries(result.fieldErrors ?? {})) {
          // `bedConfig.<posição>.quantity` → campo da cama que ocupa essa posição no envio.
          const bed = /^bedConfig\.(\d+)\./.exec(key)
          const type = bed ? bedConfig[Number(bed[1])]?.type : undefined
          errors[type ? `bed_${type}` : key] ??= msg
        }
        setFieldErrors(errors)
        setFormError(formErrorMessage(result.error, errors, VISIBLE_FIELDS))
        return
      }
      router.refresh()
      onDone()
    } catch {
      setFormError(SAVE_FAILED_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={keepValuesOnSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nome comercial"
          name="name"
          error={fieldErrors.name}
          defaultValue={room?.name}
          required
        />
        <Input
          label="Código interno"
          name="code"
          error={fieldErrors.code}
          defaultValue={room?.code ?? ''}
          placeholder="Ex.: STD-01"
        />
        {/* O erro fica fora do <label> para não entrar no nome acessível do campo. */}
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Categoria
            </span>
            <select
              name="categoryId"
              aria-invalid={fieldErrors.categoryId ? true : undefined}
              defaultValue={room?.categoryId ?? ''}
              className="border-input bg-card text-foreground focus:border-ring aria-invalid:border-destructive rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            >
              <option value="">Sem categoria</option>
              {categories
                .filter((c) => c.status === 'active' || c.id === room?.categoryId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          {fieldErrors.categoryId && (
            <p role="alert" className="text-destructive text-xs">
              {fieldErrors.categoryId}
            </p>
          )}
        </div>
        <Input
          label="Localização (andar/bloco)"
          name="location"
          error={fieldErrors.location}
          defaultValue={room?.location ?? ''}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Input
          label="Capacidade padrão"
          name="capacity"
          error={fieldErrors.capacity}
          type="number"
          min={1}
          defaultValue={room?.capacity ?? 2}
          required
        />
        <Input
          label="Capacidade máxima"
          name="capacityMax"
          error={fieldErrors.capacityMax}
          type="number"
          min={1}
          defaultValue={room?.capacityMax ?? ''}
        />
        <Input
          label="Adultos máx."
          name="adultsMax"
          error={fieldErrors.adultsMax}
          type="number"
          min={1}
          defaultValue={room?.adultsMax ?? ''}
        />
        <Input
          label="Crianças máx."
          name="childrenMax"
          error={fieldErrors.childrenMax}
          type="number"
          min={0}
          defaultValue={room?.childrenMax ?? 0}
        />
      </div>

      <div>
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Configuração de camas
        </span>
        <div className="mt-1.5 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {BED_TYPES.map((b) => (
            <Input
              key={b.value}
              label={b.label}
              name={`bed_${b.value}`}
              error={fieldErrors[`bed_${b.value}`]}
              type="number"
              min={0}
              defaultValue={room?.bedConfig.find((c) => c.type === b.value)?.quantity ?? 0}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="text-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="infantsAllowed"
            defaultChecked={room?.infantsAllowed ?? true}
          />{' '}
          Aceita bebês
        </label>
        <label className="text-foreground flex items-center gap-2 text-sm">
          <input type="checkbox" name="petsAllowed" defaultChecked={room?.petsAllowed ?? false} />{' '}
          Aceita pets
        </label>
        <label className="text-foreground flex items-center gap-2 text-sm">
          <input type="checkbox" name="accessible" defaultChecked={room?.accessible ?? false} />{' '}
          Acessível
        </label>
        <label className="text-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="publicVisible"
            defaultChecked={room?.publicVisible ?? true}
          />{' '}
          Visível na página pública
        </label>
      </div>

      {amenities.length > 0 && (
        <div>
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Comodidades
          </span>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
            {amenities.map((a) => (
              <label key={a.id} className="text-foreground flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(a.id)}
                  onChange={() => toggleAmenity(a.id)}
                />
                {a.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Diária base (R$)"
          name="basePrice"
          error={fieldErrors.basePrice}
          type="number"
          min={0}
          defaultValue={room?.basePrice ?? 0}
          required
        />
        <Input
          label="Ordem de exibição"
          name="displayOrder"
          error={fieldErrors.displayOrder}
          type="number"
          min={0}
          defaultValue={room?.displayOrder ?? 0}
        />
      </div>

      <Textarea
        label="Descrição pública"
        name="description"
        error={fieldErrors.description}
        rows={3}
        defaultValue={room?.description ?? ''}
      />
      <Textarea
        label="Descrição operacional (interna)"
        name="operationalDescription"
        error={fieldErrors.operationalDescription}
        rows={2}
        defaultValue={room?.operationalDescription ?? ''}
      />
      <Textarea
        label="Observações internas"
        name="internalNotes"
        error={fieldErrors.internalNotes}
        rows={2}
        defaultValue={room?.internalNotes ?? ''}
      />

      {formError && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando…' : room ? 'Salvar alterações' : 'Criar acomodação'}
        </Button>
      </div>
    </form>
  )
}
