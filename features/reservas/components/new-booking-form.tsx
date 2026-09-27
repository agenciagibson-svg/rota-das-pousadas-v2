'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarSearch, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { checkAvailabilityAction } from '@/features/acomodacoes/actions'
import { createBookingAdminAction } from '../actions'
import { calculateBookingPrice } from '../pricing'
import type { ManagedRoom, AvailabilityResult } from '@/features/acomodacoes/types'
import { ORIGIN_LABEL } from '@/features/gestao/components/origin-labels'
import type { BookingOrigin } from '../types'
import { keepValuesOnSubmit } from '@/lib/forms'
import { formatBRL } from '@/lib/format'

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

export function NewBookingForm({ rooms }: { rooms: ManagedRoom[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [pets, setPets] = useState(false)

  const [results, setResults] = useState<AvailabilityResult[] | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null
  const [nightlyRate, setNightlyRate] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [surcharge, setSurcharge] = useState(0)
  const [servicesAmount, setServicesAmount] = useState(0)

  const price =
    checkin && checkout && nightlyRate > 0
      ? calculateBookingPrice(nightlyRate, checkin, checkout, {
          discount,
          surcharge,
          servicesAmount,
        })
      : null

  function runAvailabilityCheck() {
    setError(null)
    setResults(null)
    setSelectedRoomId(null)
    if (!checkin || !checkout) {
      setError('Informe o período.')
      return
    }
    setChecking(true)
    startTransition(async () => {
      const result = await checkAvailabilityAction({ checkin, checkout, adults, children, pets })
      setChecking(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setResults(result.data)
    })
  }

  function selectRoom(room: AvailabilityResult) {
    setSelectedRoomId(room.roomId)
    const managed = rooms.find((r) => r.id === room.roomId)
    setNightlyRate(managed?.basePrice ?? 0)
  }

  function submit(formData: FormData) {
    if (!selectedRoomId) {
      setError('Selecione uma acomodação disponível.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createBookingAdminAction({
        roomId: selectedRoomId,
        checkin,
        checkout,
        adults,
        children,
        infants,
        pets,
        guestFullName: String(formData.get('guestFullName') || ''),
        guestEmail: String(formData.get('guestEmail') || ''),
        guestPhone: String(formData.get('guestPhone') || ''),
        origin: String(formData.get('origin') || 'balcao') as BookingOrigin,
        externalChannelName: String(formData.get('externalChannelName') || ''),
        externalCode: String(formData.get('externalCode') || ''),
        nightlyRate,
        discount,
        surcharge,
        servicesAmount,
        expectedArrivalTime: String(formData.get('expectedArrivalTime') || ''),
        specialRequests: String(formData.get('specialRequests') || ''),
        internalNotes: String(formData.get('internalNotes') || ''),
        initialStatus: String(formData.get('initialStatus') || 'quote') as
          'quote' | 'pending' | 'confirmed',
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/dashboard/reservas/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="text-foreground font-semibold">1. Período e hóspedes</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <Field label="Check-in">
            <input
              type="date"
              value={checkin}
              onChange={(e) => setCheckin(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Check-out">
            <input
              type="date"
              value={checkout}
              onChange={(e) => setCheckout(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Adultos">
            <input
              type="number"
              min={1}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Crianças">
            <input
              type="number"
              min={0}
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Bebês">
            <input
              type="number"
              min={0}
              value={infants}
              onChange={(e) => setInfants(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>
        <label className="text-muted-foreground mt-3 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} />
          Hóspede leva pet
        </label>
        <div className="mt-4">
          <Button type="button" onClick={runAvailabilityCheck} disabled={checking || isPending}>
            <CalendarSearch className="size-4" />
            {checking ? 'Verificando…' : 'Verificar disponibilidade'}
          </Button>
        </div>
      </Card>

      {results && (
        <Card className="p-5">
          <h2 className="text-foreground font-semibold">2. Escolha a acomodação</h2>
          <div className="mt-4 space-y-2">
            {results.length === 0 && (
              <p className="text-muted-foreground text-sm">Nenhuma acomodação cadastrada.</p>
            )}
            {results.map((r) => (
              <button
                key={r.roomId}
                type="button"
                disabled={!r.available}
                onClick={() => selectRoom(r)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selectedRoomId === r.roomId
                    ? 'border-primary bg-primary/5'
                    : r.available
                      ? 'border-border hover:border-primary/50'
                      : 'border-border bg-secondary/40 opacity-60'
                }`}
              >
                <span>
                  <span className="text-foreground font-medium">{r.roomName}</span>
                  {r.categoryName && (
                    <span className="text-muted-foreground"> · {r.categoryName}</span>
                  )}
                  <span className="text-muted-foreground"> · até {r.capacity} hóspedes</span>
                </span>
                {r.available ? (
                  <CheckCircle2 className="text-primary size-4" />
                ) : (
                  <span className="text-destructive inline-flex items-center gap-1 text-xs">
                    <XCircle className="size-3.5" />
                    Indisponível
                  </span>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {selectedRoom && (
        <form onSubmit={keepValuesOnSubmit(submit)} className="space-y-5">
          <Card className="p-5">
            <h2 className="text-foreground font-semibold">3. Hóspede responsável</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Nome completo">
                <input name="guestFullName" required className={inputClass} />
              </Field>
              <Field label="E-mail">
                <input name="guestEmail" type="email" className={inputClass} />
              </Field>
              <Field label="Telefone">
                <input name="guestPhone" className={inputClass} />
              </Field>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Se já existir um hóspede desta pousada com o mesmo e-mail, telefone ou documento, o
              cadastro é reaproveitado automaticamente.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-foreground font-semibold">4. Valores</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Field label="Diária (R$)">
                <input
                  type="number"
                  min={0}
                  value={nightlyRate}
                  onChange={(e) => setNightlyRate(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="Desconto (R$)">
                <input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="Acréscimo (R$)">
                <input
                  type="number"
                  min={0}
                  value={surcharge}
                  onChange={(e) => setSurcharge(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="Serviços previstos (R$)">
                <input
                  type="number"
                  min={0}
                  value={servicesAmount}
                  onChange={(e) => setServicesAmount(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
            {price && (
              <div className="border-border bg-secondary/40 mt-4 space-y-1.5 rounded-2xl border p-4 text-sm">
                <div className="text-muted-foreground flex justify-between">
                  <span>
                    {formatBRL(nightlyRate)} × {price.nights}{' '}
                    {price.nights === 1 ? 'noite' : 'noites'}
                  </span>
                  <span>{formatBRL(price.subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="text-muted-foreground flex justify-between">
                    <span>Desconto</span>
                    <span>−{formatBRL(discount)}</span>
                  </div>
                )}
                {surcharge > 0 && (
                  <div className="text-muted-foreground flex justify-between">
                    <span>Acréscimo</span>
                    <span>{formatBRL(surcharge)}</span>
                  </div>
                )}
                {servicesAmount > 0 && (
                  <div className="text-muted-foreground flex justify-between">
                    <span>Serviços</span>
                    <span>{formatBRL(servicesAmount)}</span>
                  </div>
                )}
                <div className="border-border text-foreground flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatBRL(price.total)}</span>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-foreground font-semibold">5. Origem e observações</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Origem">
                <select name="origin" defaultValue="balcao" className={inputClass}>
                  {ORIGINS.map((o) => (
                    <option key={o} value={o}>
                      {ORIGIN_LABEL[o]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Canal externo (se aplicável)">
                <input name="externalChannelName" className={inputClass} />
              </Field>
              <Field label="Código externo (se aplicável)">
                <input name="externalCode" className={inputClass} />
              </Field>
            </div>
            <div className="mt-3 grid gap-3">
              <Field label="Horário previsto de chegada">
                <input name="expectedArrivalTime" placeholder="ex.: 18:00" className={inputClass} />
              </Field>
              <Field label="Solicitações especiais do hóspede">
                <textarea name="specialRequests" rows={2} className={inputClass} />
              </Field>
              <Field label="Observações internas (nunca visível ao hóspede)">
                <textarea name="internalNotes" rows={2} className={inputClass} />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-foreground font-semibold">6. Revisão e confirmação</h2>
            <Field label="Salvar como">
              <select name="initialStatus" defaultValue="quote" className={inputClass}>
                <option value="quote">Cotação</option>
                <option value="pending">Pendente (aguardando pagamento)</option>
                <option value="confirmed">Confirmada</option>
              </select>
            </Field>
            {error && <p className="text-destructive mt-3 text-sm font-medium">{error}</p>}
            <div className="mt-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Criando…' : 'Criar reserva'}
              </Button>
            </div>
          </Card>
        </form>
      )}

      {!selectedRoom && error && <p className="text-destructive text-sm font-medium">{error}</p>}
    </div>
  )
}
