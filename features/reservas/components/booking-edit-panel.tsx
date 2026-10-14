'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateBookingAction, setBookingCompanionsAction } from '../actions'
import { ORIGIN_LABEL } from '@/features/gestao/components/origin-labels'
import type { BookingDetail, BookingOrigin } from '../types'
import { SAVE_FAILED_MESSAGE, formErrorMessage, keepValuesOnSubmit } from '@/lib/forms'

const inputClass =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring aria-invalid:border-destructive'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  // O erro fica fora do <label> para não entrar no nome acessível do campo.
  return (
    <div>
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{label}</span>
        {children}
      </label>
      {error && (
        <p role="alert" className="text-destructive mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

const ORIGINS = Object.keys(ORIGIN_LABEL) as BookingOrigin[]

/** Campos com lugar na tela para mostrar o erro; o resto vai para a mensagem geral. */
const VISIBLE_FIELDS = [
  'checkin',
  'checkout',
  'adults',
  'children',
  'infants',
  'origin',
  'expectedArrivalTime',
  'nightlyRate',
  'discount',
  'surcharge',
  'servicesAmount',
  'specialRequests',
  'internalNotes',
]

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const nightly =
    booking.nights > 0
      ? Math.round((booking.subtotal / booking.nights) * 100) / 100
      : booking.subtotal

  function submit(formData: FormData) {
    setError(null)
    setFieldErrors({})
    startTransition(async () => {
      // Sem o try/catch, uma queda de rede derrubava a tela no error boundary.
      try {
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
          const errors = result.fieldErrors ?? {}
          setFieldErrors(errors)
          setError(formErrorMessage(result.error, errors, VISIBLE_FIELDS))
          return
        }
        router.refresh()
      } catch {
        setError(SAVE_FAILED_MESSAGE)
      }
    })
  }

  if (!canEdit) return null

  return (
    <form onSubmit={keepValuesOnSubmit(submit)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Check-in" error={fieldErrors.checkin}>
          <input
            name="checkin"
            aria-invalid={fieldErrors.checkin ? true : undefined}
            type="date"
            defaultValue={booking.checkin}
            className={inputClass}
          />
        </Field>
        <Field label="Check-out" error={fieldErrors.checkout}>
          <input
            name="checkout"
            aria-invalid={fieldErrors.checkout ? true : undefined}
            type="date"
            defaultValue={booking.checkout}
            className={inputClass}
          />
        </Field>
        <Field label="Adultos" error={fieldErrors.adults}>
          <input
            name="adults"
            aria-invalid={fieldErrors.adults ? true : undefined}
            type="number"
            min={1}
            defaultValue={booking.adults}
            className={inputClass}
          />
        </Field>
        <Field label="Crianças" error={fieldErrors.children}>
          <input
            name="children"
            aria-invalid={fieldErrors.children ? true : undefined}
            type="number"
            min={0}
            defaultValue={booking.children}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Bebês" error={fieldErrors.infants}>
          <input
            name="infants"
            aria-invalid={fieldErrors.infants ? true : undefined}
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
        <Field label="Origem" error={fieldErrors.origin}>
          <select
            name="origin"
            aria-invalid={fieldErrors.origin ? true : undefined}
            defaultValue={booking.origin}
            className={inputClass}
          >
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {ORIGIN_LABEL[o]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Horário previsto" error={fieldErrors.expectedArrivalTime}>
          <input
            name="expectedArrivalTime"
            aria-invalid={fieldErrors.expectedArrivalTime ? true : undefined}
            defaultValue={booking.expectedArrivalTime ?? ''}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Diária (R$)" error={fieldErrors.nightlyRate}>
          <input
            name="nightlyRate"
            aria-invalid={fieldErrors.nightlyRate ? true : undefined}
            type="number"
            min={0}
            defaultValue={nightly}
            className={inputClass}
          />
        </Field>
        <Field label="Desconto (R$)" error={fieldErrors.discount}>
          <input
            name="discount"
            aria-invalid={fieldErrors.discount ? true : undefined}
            type="number"
            min={0}
            defaultValue={booking.discount}
            className={inputClass}
          />
        </Field>
        <Field label="Acréscimo (R$)" error={fieldErrors.surcharge}>
          <input
            name="surcharge"
            aria-invalid={fieldErrors.surcharge ? true : undefined}
            type="number"
            min={0}
            defaultValue={booking.surcharge}
            className={inputClass}
          />
        </Field>
        <Field label="Serviços (R$)" error={fieldErrors.servicesAmount}>
          <input
            name="servicesAmount"
            aria-invalid={fieldErrors.servicesAmount ? true : undefined}
            type="number"
            min={0}
            defaultValue={booking.servicesAmount}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Solicitações especiais" error={fieldErrors.specialRequests}>
        <textarea
          name="specialRequests"
          aria-invalid={fieldErrors.specialRequests ? true : undefined}
          rows={2}
          defaultValue={booking.specialRequests}
          className={inputClass}
        />
      </Field>
      <Field label="Observações internas" error={fieldErrors.internalNotes}>
        <textarea
          name="internalNotes"
          aria-invalid={fieldErrors.internalNotes ? true : undefined}
          rows={2}
          defaultValue={booking.internalNotes}
          className={inputClass}
        />
      </Field>
      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Salvando…' : 'Salvar alterações'}
      </Button>
    </form>
  )
}

const COMPANION_NAME_KEY = /^companions\.\d+\.fullName$/

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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
    // Os erros são por posição da linha; ao remover uma, deixam de valer.
    setFieldErrors({})
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function save() {
    setError(null)
    setFieldErrors({})
    startTransition(async () => {
      // Sem o try/catch, uma queda de rede derrubava a tela no error boundary.
      try {
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
          const errors = result.fieldErrors ?? {}
          setFieldErrors(errors)
          // Só o nome tem campo em cada linha (`companions.<linha>.fullName`).
          setError(formErrorMessage(result.error, errors, (key) => COMPANION_NAME_KEY.test(key)))
          return
        }
        router.refresh()
      } catch {
        setError(SAVE_FAILED_MESSAGE)
      }
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
          <div>
            <input
              value={row.fullName}
              onChange={(e) => updateRow(i, { fullName: e.target.value })}
              placeholder="Nome"
              aria-invalid={fieldErrors[`companions.${i}.fullName`] ? true : undefined}
              className={inputClass}
            />
            {fieldErrors[`companions.${i}.fullName`] && (
              <p role="alert" className="text-destructive mt-1 text-xs">
                {fieldErrors[`companions.${i}.fullName`]}
              </p>
            )}
          </div>
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
      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
