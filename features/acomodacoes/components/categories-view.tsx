'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Layers, Plus, RotateCcw } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AcomodacoesTabs } from './acomodacoes-tabs'
import { createCategoryAction, updateCategoryAction, setCategoryStatusAction } from '../actions'
import type { AccommodationCategory } from '../types'
import type { ActionResult } from '@/types'
import { SAVE_FAILED_MESSAGE, formErrorMessage, keepValuesOnSubmit } from '@/lib/forms'
import { formatPrice } from '@/lib/format'

/** Campos com lugar na tela para mostrar o erro; o resto vai para a mensagem geral. */
const VISIBLE_FIELDS = [
  'name',
  'code',
  'defaultCapacity',
  'maxCapacity',
  'defaultBedCount',
  'basePriceSuggestion',
  'description',
]

function CategoryForm({
  category,
  onDone,
}: {
  category?: AccommodationCategory
  onDone: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  async function onSubmit(formData: FormData) {
    setError(null)
    setFieldErrors({})
    setPending(true)
    const payload = {
      name: String(formData.get('name') ?? ''),
      code: String(formData.get('code') ?? ''),
      description: String(formData.get('description') ?? ''),
      defaultCapacity: Number(formData.get('defaultCapacity') ?? 2),
      maxCapacity: formData.get('maxCapacity') ? Number(formData.get('maxCapacity')) : undefined,
      defaultBedCount: Number(formData.get('defaultBedCount') ?? 1),
      basePriceSuggestion: formData.get('basePriceSuggestion')
        ? Number(formData.get('basePriceSuggestion'))
        : undefined,
      // O formulário não tem campo de ordem: ao editar, mantém a que já estava
      // (antes ia sempre 0 e a edição desfazia a ordenação).
      displayOrder: category?.displayOrder ?? 0,
    }
    // try/finally: se a action lançar (queda de rede), o botão não fica travado.
    try {
      const result = category
        ? await updateCategoryAction({ ...payload, id: category.id })
        : await createCategoryAction(payload)
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
    <form onSubmit={keepValuesOnSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nome"
          name="name"
          error={fieldErrors.name}
          defaultValue={category?.name}
          required
        />
        <Input
          label="Código"
          name="code"
          error={fieldErrors.code}
          defaultValue={category?.code ?? ''}
        />
        <Input
          label="Capacidade padrão"
          name="defaultCapacity"
          error={fieldErrors.defaultCapacity}
          type="number"
          min={1}
          defaultValue={category?.defaultCapacity ?? 2}
        />
        <Input
          label="Capacidade máxima"
          name="maxCapacity"
          error={fieldErrors.maxCapacity}
          type="number"
          min={1}
          defaultValue={category?.maxCapacity ?? ''}
        />
        <Input
          label="Camas padrão"
          name="defaultBedCount"
          error={fieldErrors.defaultBedCount}
          type="number"
          min={1}
          defaultValue={category?.defaultBedCount ?? 1}
        />
        <Input
          label="Valor-base sugerido (R$)"
          name="basePriceSuggestion"
          error={fieldErrors.basePriceSuggestion}
          type="number"
          min={0}
          defaultValue={category?.basePriceSuggestion ?? ''}
        />
      </div>
      <Textarea
        label="Descrição"
        name="description"
        error={fieldErrors.description}
        rows={2}
        defaultValue={category?.description ?? ''}
      />
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
          {pending ? 'Salvando…' : category ? 'Salvar' : 'Criar categoria'}
        </Button>
      </div>
    </form>
  )
}

export function CategoriesView({
  displayName,
  pousadaName,
  categories,
  canManage,
}: {
  displayName: string
  pousadaName: string
  categories: AccommodationCategory[]
  canManage: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<AccommodationCategory | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function run(promise: Promise<ActionResult<unknown>>) {
    setError(null)
    setPending(true)
    promise
      .then((result) => {
        if (!result.ok) {
          // Aqui não há campo na tela: os erros de validação vão todos na mensagem geral.
          setError([result.error, ...new Set(Object.values(result.fieldErrors ?? {}))].join(' '))
          return
        }
        router.refresh()
      })
      .catch(() => setError(SAVE_FAILED_MESSAGE))
      // finally: se a action lançar (queda de rede), os botões não ficam travados.
      .finally(() => setPending(false))
  }

  return (
    <DashboardShell
      nav={ownerDashboardNav('acomodacoes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Categorias"
      subtitle="Agrupamentos de acomodação — Standard, Luxo, Suíte…"
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <AcomodacoesTabs active="categorias" />

      <div className="mt-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {error && (
              <p role="alert" className="text-destructive text-sm font-medium">
                {error}
              </p>
            )}
          </div>
          {canManage && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Nova categoria
            </Button>
          )}
        </div>

        <Card className="p-4">
          {categories.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Nenhuma categoria"
              description="Crie a primeira categoria de acomodação."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Acomodações</TableHead>
                  <TableHead>Capacidade padrão</TableHead>
                  <TableHead>Valor-base</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button
                        onClick={() => canManage && setEditing(c)}
                        className="text-foreground text-left font-medium hover:underline"
                      >
                        {c.name}
                      </button>
                      {c.code && <div className="text-muted-foreground text-xs">{c.code}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.roomCount}</TableCell>
                    <TableCell className="text-muted-foreground">{c.defaultCapacity}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.basePriceSuggestion != null ? formatPrice(c.basePriceSuggestion) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.status === 'active' ? 'primarySoft' : 'secondary'}
                        size="sm"
                      >
                        {c.status === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
                          aria-label={
                            c.status === 'active' ? `Inativar ${c.name}` : `Reativar ${c.name}`
                          }
                          onClick={() =>
                            run(
                              setCategoryStatusAction({
                                id: c.id,
                                status: c.status === 'active' ? 'inactive' : 'active',
                              }),
                            )
                          }
                        >
                          {c.status === 'active' ? <Ban /> : <RotateCcw />}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nova categoria' : `Editar ${editing ? editing.name : ''}`}
      >
        {editing !== null && (
          <CategoryForm
            category={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </DashboardShell>
  )
}
