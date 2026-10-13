'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImageUpload } from '@/components/ui/image-upload'
import { keepValuesOnSubmit } from '@/lib/forms'
import { saveInventoryItemAction } from '../actions'
import {
  CATEGORY_LABEL,
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  UNIT_LABEL,
  type InventoryCategory,
  type InventoryUnit,
} from '../labels'
import type { InventoryItem } from '../types'

const SELECT =
  'border-input bg-card text-foreground focus:border-ring rounded-xl border px-3.5 py-2.5 text-sm outline-none'
const LABEL = 'text-foreground text-sm font-medium'

/** Cadastro/edição de item. Quantidade só no cadastro — depois, por movimento. */
export function ItemForm({
  item,
  pousadaId,
  seeCosts,
  onDone,
}: {
  item?: InventoryItem
  pousadaId: string
  seeCosts: boolean
  onDone: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const [trackStock, setTrackStock] = useState(item?.trackStock ?? true)
  const [showInApp, setShowInApp] = useState(item?.showInApp ?? false)
  const [category, setCategory] = useState<InventoryCategory>(item?.category ?? 'bebidas')
  const [photos, setPhotos] = useState<string[]>(item?.photoUrl ? [item.photoUrl] : [])

  async function submit(formData: FormData) {
    setError(null)
    setFieldErrors({})
    setPending(true)
    try {
      const result = await saveInventoryItemAction({
        id: item?.id,
        name: String(formData.get('name') ?? ''),
        category,
        unit: String(formData.get('unit') ?? 'un') as InventoryUnit,
        trackStock,
        initialQuantity: String(formData.get('initialQuantity') ?? '0') || '0',
        minQuantity: String(formData.get('minQuantity') ?? '0') || '0',
        unitCost: String(formData.get('unitCost') ?? ''),
        salePrice: String(formData.get('salePrice') ?? ''),
        showInApp,
        description: String(formData.get('description') ?? ''),
        photoUrl: photos[0] ?? '',
      })
      if (!result.ok) {
        setError(result.fieldErrors ? 'Revise os campos destacados.' : result.error)
        setFieldErrors(result.fieldErrors ?? {})
        return
      }
      router.refresh()
      onDone()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={keepValuesOnSubmit(submit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nome"
          name="name"
          defaultValue={item?.name}
          placeholder="Ex.: Água sem gás 500 ml"
          error={fieldErrors.name}
          required
        />
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Categoria</span>
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value as InventoryCategory
              setCategory(next)
              // Serviço (toalha extra, limpeza) não tem estoque.
              if (next === 'servicos') setTrackStock(false)
            }}
            className={SELECT}
          >
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={trackStock}
          onChange={(e) => setTrackStock(e.target.checked)}
        />
        <span>
          <span className="text-foreground font-medium">Controlar quantidade em estoque</span>
          <span className="text-muted-foreground block text-xs">
            Desmarque para serviços (toalha extra, limpeza, late checkout).
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Unidade</span>
          <select name="unit" defaultValue={item?.unit ?? 'un'} className={SELECT}>
            {INVENTORY_UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABEL[u]}
              </option>
            ))}
          </select>
        </label>
        {trackStock && !item && (
          <Input
            label="Quantidade atual"
            name="initialQuantity"
            type="number"
            min={0}
            step="any"
            defaultValue={0}
            error={fieldErrors.initialQuantity}
          />
        )}
        {trackStock && (
          <Input
            label="Avisar quando chegar a"
            name="minQuantity"
            type="number"
            min={0}
            step="any"
            defaultValue={item?.minQuantity ?? 0}
            hint="Estoque mínimo"
            error={fieldErrors.minQuantity}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {seeCosts && (
          <Input
            label="Custo por unidade (R$)"
            name="unitCost"
            type="number"
            min={0}
            step="0.01"
            defaultValue={item?.unitCost ?? ''}
            hint="Opcional. Atualiza a cada entrada com custo."
            error={fieldErrors.unitCost}
          />
        )}
        <Input
          label="Preço para o hóspede (R$)"
          name="salePrice"
          type="number"
          min={0}
          step="0.01"
          defaultValue={item?.salePrice ?? ''}
          hint="Use 0 para cortesia. Vazio = não é vendido."
          error={fieldErrors.salePrice}
        />
      </div>

      <label className="border-success/30 bg-success/10/50 flex items-start gap-2 rounded-xl border p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={showInApp}
          onChange={(e) => setShowInApp(e.target.checked)}
        />
        <span>
          <span className="text-foreground font-medium">Mostrar no app do hóspede</span>
          <span className="text-muted-foreground block text-xs">
            O hóspede vê este item no cardápio da estadia e pode pedir pelo celular.
          </span>
        </span>
      </label>

      {showInApp && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Descrição no app</span>
            <textarea
              name="description"
              defaultValue={item?.description}
              rows={2}
              maxLength={300}
              placeholder="Ex.: Gelada, entregue no chalé."
              className="border-input bg-card text-foreground focus:border-ring resize-none rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            />
          </label>
          <ImageUpload
            label="Foto no app (opcional)"
            value={photos}
            onChange={(urls) => setPhotos(urls.slice(-1))}
            folder={pousadaId}
            max={1}
          />
        </>
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
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando…' : item ? 'Salvar item' : 'Cadastrar item'}
        </Button>
      </div>
    </form>
  )
}
