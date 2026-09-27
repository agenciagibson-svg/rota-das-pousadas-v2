'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateBookingAction, setBookingCompanionsAction } from '../actions'
import { ORIGIN_LABEL } from '@/features/gestao/components/origin-labels'
import type { BookingDetail, BookingOrigin } from '../types'
import { keepValuesOnSubmit } from '@/lib/forms'

const inputClass =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  )
}

const ORIGINS = Object.keys(ORIGIN_LABEL) as BookingOrigin[]

export function BookingEditPanel({
  booking,
  canEdit,
}: {
  booking: BookingDetail
  canEdit: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const nightly =
    booking.nights > 0
      ? Math.round((booking.subtotal / booking.nights) * 100) / 100
      : booking.subtotal

  function submit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await updateBookingAction({
        bookingId: booking.id,
        version: booking.version,
        roomId: booking.roomId,
        guestId: booking.responsibleGuestId,
        checkin: String(formData.get('checkin')),
        checkout: String(formData.get('checkout')),
        adults: Number(formData.get('adults')),
        children: Number(formData.get('children')),
        infants: Number(formData.get('infants')),
        pets: formData.get('pets') === 'on',
        nightlyRate: Number(formData.get('nightlyRate')),
        discount: Number(formData.get('discount')),
        surcharge: Number(formData.get('surcharge')),
        servicesAmount: Number(formData.get('servicesAmount')),
        origin: String(formData.get('origin')) as BookingOrigin,
        expectedArrivalTime: String(formData.get('expectedArrivalTime') || ''),
        specialRequests: String(formData.get('specialRequests') || ''),
        internalNotes: String(formData.get('internalNotes') || ''),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  if (!canEdit) return null

  return (
    <form onSubmit={keepValuesOnSubmit(submit)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Check-in">
          <input name="checkin" type="date" defaultValue={booking.checkin} className={inputClass} />
        </Field>
        <Field label="Check-out">
          <input
            name="checkout"
            type="date"
            defaultValue={booking.checkout}
            className={inputClass}
          />
        </Field>
        <Field label="Adultos">
          <input
            name="adults"
            type="number"
            min={1}
            defaultValue={booking.adults}
            className={inputClass}
          />
        </Field>
        <Field label="Crianças">
          <input
            name="children"
            type="number"
            min={0}
            defaultValue={booking.children}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Bebês">
          <input
            name="infants"
            type="number"
            min={0}
            defaultValue={booking.infants}
            className={inputClass}
          />
        </Field>
        <label className="text-muted-foreground flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="pets" defaultChecked={booking.pets} />
          Leva pet
        </label>
        <Field label="Origem">
          <select name="origin" defaultValue={booking.origin} className={inputClass}>
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {ORIGIN_LABEL[o]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Horário previsto">
          <input
            name="expectedArrivalTime"
            defaultValue={booking.expectedArrivalTime ?? ''}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Diária (R$)">
          <input
            name="nightlyRate"
            type="number"
            min={0}
            defaultValue={nightly}
            className={inputClass}
          />
        </Field>
        <Field label="Desconto (R$)">
          <input
            name="discount"
            type="number"
            min={0}
            defaultValue={booking.discount}
            className={inputClass}
          />
        </Field>
        <Field label="Acréscimo (R$)">
          <input
            name="surcharge"
            type="number"
            min={0}
            defaultValue={booking.surcharge}
            className={inputClass}
          />
        </Field>
        <Field label="Serviços (R$)">
          <input
            name="servicesAmount"
            type="number"
            min={0}
            defaultValue={booking.servicesAmount}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Solicitações especiais">
        <textarea
          name="specialRequests"
          rows={2}
          defaultValue={booking.specialRequests}
          className={inputClass}
        />
      </Field>
      <Field label="Observações internas">
        <textarea
          name="internalNotes"
          rows={2}
          defaultValue={booking.internalNotes}
          className={inputClass}
        />
      </Field>
      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Salvando…' : 'Salvar alterações'}
      </Button>
    </form>
  )
}

export function BookingCompanionsPanel({
  booking,
  canEdit,
}: {
  booking: BookingDetail
  canEdit: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState(
    booking.companions.length > 0
      ? booking.companions
      : [
          {
            id: 'new-responsible',
            guestId: null,
            fullName: booking.guestName,
            guestType: 'responsible' as const,
            hasSpecialNeeds: false,
            birthDate: null,
            documentType: null,
            documentNumber: null,
            operationalNotes: '',
          },
        ],
  )

  function updateRow(index: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: `new-${prev.length}`,
        guestId: null,
        fullName: '',
        guestType: 'adult',
        hasSpecialNeeds: false,
        birthDate: null,
        documentType: null,
        documentNumber: null,
        operationalNotes: '',
      },
    ])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await setBookingCompanionsAction({
        bookingId: booking.id,
        version: booking.version,
        companions: rows.map((r) => ({
          guestId: r.guestId ?? undefined,
          fullName: r.fullName,
          guestType: r.guestType,
          hasSpecialNeeds: r.hasSpecialNeeds,
          birthDate: r.birthDate ?? '',
          documentType: r.documentType ?? '',
          documentNumber: r.documentNumber ?? '',
          operationalNotes: r.operationalNotes,
        })),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  if (!canEdit) {
    return (
      <ul className="text-muted-foreground space-y-2 text-sm">
        {booking.companions.map((c) => (
          <li key={c.id}>
            {c.fullName} — {c.guestType}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div
          key={row.id}
          className="border-border grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <input
            value={row.fullName}
            onChange={(e) => updateRow(i, { fullName: e.target.value })}
            placeholder="Nome"
            className={inputClass}
          />
          <select
            value={row.guestType}
            onChange={(e) =>
              updateRow(i, { guestType: e.target.value as (typeof row)['guestType'] })
            }
            className={inputClass}
          >
            <option value="responsible">Responsável</option>
            <option value="adult">Adulto</option>
            <option value="child">Criança</option>
            <option value="infant">Bebê</option>
          </select>
          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={row.hasSpecialNeeds}
              onChange={(e) => updateRow(i, { hasSpecialNeeds: e.target.checked })}
            />
            Necessidade específica
          </label>
          <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)}>
            Remover
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          Adicionar acompanhante
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={isPending}>
          {isPending ? 'Salvando…' : 'Salvar acompanhantes'}
        </Button>
      </div>
      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
    </div>
  )
}
