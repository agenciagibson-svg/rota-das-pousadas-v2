import 'server-only'
import { getPousadaRepository } from '@/repositories/pousadas.repository'
import { DEMO_STAY_ID } from '@/features/estadia/demo'
import { isoDateInTimeZone } from '@/lib/dates'
import type { Pousada } from '@/types'
import type { Booking, BookingStatus } from './types'

/**
 * "Minhas reservas" no modo demonstração (preview sem Supabase): três
 * reservas fictícias — a estadia em curso (abre o app da estadia de
 * demonstração), uma viagem marcada e uma que já passou. Nunca é usada com o
 * Supabase configurado.
 */

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function booking(
  pousada: Pousada,
  id: string,
  code: string,
  checkin: string,
  nights: number,
  guests: number,
  status: BookingStatus,
): Booking {
  const subtotal = pousada.pricePerNight * nights
  const fee = Math.round(subtotal * 0.05)
  return {
    id,
    code,
    pousadaSlug: pousada.slug,
    pousadaName: pousada.name,
    pousadaImage: pousada.image,
    roomName: 'Acomodação principal',
    city: pousada.city,
    state: pousada.state,
    checkin,
    checkout: addDays(checkin, nights),
    guests,
    nights,
    subtotal,
    fee,
    discount: 0,
    surcharge: 0,
    total: subtotal + fee,
    balanceDue: 0,
    status,
    paymentDueAt: null,
    cancellationReason: null,
    createdAt: `${addDays(checkin, -20)}T10:00:00-03:00`,
  }
}

export async function demoMyBookings(): Promise<Booking[]> {
  const repo = getPousadaRepository()
  const [refugio, mare, serra] = await Promise.all([
    repo.findBySlug('refugio-das-nuvens'),
    repo.findBySlug('pousada-mare-alta'),
    repo.findBySlug('chales-serra-gelada'),
  ])
  const today = isoDateInTimeZone(new Date())
  const list: Booking[] = []
  // Mesmas datas da estadia de demonstração (features/estadia/demo.ts).
  if (refugio)
    list.push(booking(refugio, DEMO_STAY_ID, 'RP-DEMO', addDays(today, -1), 3, 2, 'checked_in'))
  if (mare) {
    list.push(
      booking(
        mare,
        '00000000-0000-4000-8000-0000000d0e02',
        'RP-DEMO2',
        addDays(today, 45),
        4,
        4,
        'confirmed',
      ),
    )
  }
  if (serra) {
    list.push(
      booking(
        serra,
        '00000000-0000-4000-8000-0000000d0e03',
        'RP-DEMO3',
        addDays(today, -120),
        2,
        2,
        'checked_out',
      ),
    )
  }
  return list
}
