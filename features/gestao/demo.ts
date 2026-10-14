import {
  addDays,
  calculateOccupancy,
  dayMovements,
  monthlyRevenue,
  pousadaToday,
  summarizeReviews,
  upcomingReservations,
  weeklyDailies,
} from '@/features/dashboard/metrics'
import type { BookingOrigin, BookingStatus } from '@/features/reservas/types'
import type { OwnerReservation } from './types'

/**
 * Painel da pousada no modo demonstração (preview sem Supabase). Reservas
 * SINTÉTICAS — nomes e e-mails fictícios (@exemplo.com.br), sem telefone —
 * passadas pelas mesmas funções de métrica do painel real: nenhum número da
 * tela é escrito à mão. Nunca é usado com o Supabase configurado.
 */

export const DEMO_POUSADA_NAME = 'Refúgio das Nuvens'
const ROOMS = [
  'Chalé Araucária',
  'Chalé Neblina',
  'Chalé Mirante',
  'Suíte Vale',
  'Suíte Lareira',
  'Chalé Bosque',
]
const GUESTS = [
  'Marina Exemplo',
  'Rafael Teste',
  'Helena Demonstração',
  'Caio Fictício',
  'Lia Amostra',
  'Bruno Exemplo',
  'Tereza Teste',
  'Otávio Amostra',
]
const ORIGINS: BookingOrigin[] = [
  'rota_das_pousadas',
  'rota_das_pousadas',
  'whatsapp',
  'site_proprio',
  'booking_com',
]
const NIGHTLY = 720

/** Gerador determinístico (mesma tela a cada visita no mesmo dia). */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function reservation(
  i: number,
  checkin: string,
  nights: number,
  status: BookingStatus,
  createdAt: string,
): OwnerReservation {
  const guestName = GUESTS[i % GUESTS.length]!
  const subtotal = nights * NIGHTLY
  const fee = Math.round(subtotal * 0.05)
  const total = subtotal + fee
  const paid = status !== 'pending' && status !== 'quote'
  return {
    id: `00000000-0000-4000-8000-${String(900000000000 + i).padStart(12, '0')}`,
    code: `RP-D${String(100 + i)}`,
    guestName,
    guestEmail: `${guestName.split(' ')[0]!.toLowerCase()}@exemplo.com.br`,
    guestPhone: null,
    roomName: ROOMS[i % ROOMS.length]!,
    checkin,
    checkout: addDays(checkin, nights),
    nights,
    guests: 2 + (i % 3),
    subtotal,
    fee,
    total,
    balanceDue: paid ? 0 : total,
    status,
    origin: ORIGINS[i % ORIGINS.length]!,
    paymentDueAt: status === 'pending' ? `${addDays(createdAt, 1)}T18:00:00-03:00` : null,
    createdAt: `${createdAt}T10:00:00-03:00`,
    needsAttention: false,
  }
}

export function demoOwnerReservations(todayISO: string): OwnerReservation[] {
  const rand = seeded(Number(todayISO.slice(0, 7).replace('-', '')))
  const list: OwnerReservation[] = []
  let i = 0
  // Histórico: ~3 estadias por mês nos últimos 11 meses.
  for (let back = 330; back > 7; back -= 9 + Math.floor(rand() * 5)) {
    const checkin = addDays(todayISO, -back)
    const nights = 2 + Math.floor(rand() * 3)
    const cancelled = rand() < 0.08
    list.push(
      reservation(
        i++,
        checkin,
        nights,
        cancelled ? 'cancelled' : 'checked_out',
        addDays(checkin, -20),
      ),
    )
  }
  // Agora: hóspedes na casa, chegadas e saídas de hoje e as próximas semanas.
  list.push(reservation(i++, addDays(todayISO, -2), 4, 'checked_in', addDays(todayISO, -30)))
  list.push(reservation(i++, addDays(todayISO, -1), 3, 'checked_in', addDays(todayISO, -12)))
  list.push(reservation(i++, addDays(todayISO, -3), 3, 'checked_out', addDays(todayISO, -40)))
  list.push(reservation(i++, todayISO, 2, 'confirmed', addDays(todayISO, -9)))
  list.push(reservation(i++, todayISO, 3, 'confirmed', addDays(todayISO, -4)))
  list.push(reservation(i++, addDays(todayISO, 2), 3, 'confirmed', addDays(todayISO, -15)))
  list.push(reservation(i++, addDays(todayISO, 4), 2, 'pending', addDays(todayISO, -1)))
  list.push(reservation(i++, addDays(todayISO, 6), 4, 'confirmed', addDays(todayISO, -22)))
  list.push(reservation(i++, addDays(todayISO, 11), 3, 'confirmed', addDays(todayISO, -6)))
  return list.sort((a, b) => b.checkin.localeCompare(a.checkin))
}

const DEMO_RATINGS = [5, 5, 4, 5, 5, 4, 5, 3, 5, 5, 4, 5, 5, 5, 4, 5]

/** Props prontas para o `OwnerDashboardView`, calculadas como no painel real. */
export function buildDemoOwnerDashboard(now: Date, timeZone = 'America/Sao_Paulo') {
  const today = pousadaToday(now, timeZone)
  const reservations = demoOwnerReservations(today.iso)
  const { arrivals, departures } = dayMovements(reservations, today.iso)
  return {
    displayName: 'Equipe de demonstração',
    pousadaName: DEMO_POUSADA_NAME,
    pousadaStatus: 'publicada',
    reservations,
    occupancy: calculateOccupancy(
      reservations,
      ROOMS.length,
      today.iso,
      addDays(today.iso, 7),
      today.date,
    ),
    revenueSeries: monthlyRevenue(reservations, today.date),
    showRevenue: true,
    week: weeklyDailies(reservations, today.date),
    reviews: summarizeReviews(DEMO_RATINGS.map((rating) => ({ rating }))),
    arrivalsToday: arrivals,
    departuresToday: departures,
    upcomingReservations: upcomingReservations(reservations, today.iso),
  }
}
