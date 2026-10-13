import 'server-only'
import { getPousadaRepository } from '@/repositories/pousadas.repository'
import { isoDateInTimeZone } from '@/lib/dates'
import type { GuestOrder } from '@/features/pedidos/types'
import { parseGuestStay, type GuestStay } from './types'
import type { MyStay } from './services/stay.service'

/**
 * Estadia de exemplo do modo demonstração (preview sem Supabase): o app da
 * estadia abre direto em `/estadia`, sem login nem reserva confirmada, para
 * dar para ver a experiência. Dados sintéticos sobre a pousada de exemplo; sem
 * telefones (nada de ligar para um número real a partir da demonstração).
 * Nunca é usada com o Supabase configurado.
 */
export const DEMO_STAY_ID = '00000000-0000-4000-8000-00000000e57a'
/** Ids no formato UUID: as ações do app validam `bookingId`, `itemId` e `orderId`. */
const demoId = (suffix: string) => `00000000-0000-4000-8000-0000000000${suffix}`
const DEMO_SLUG = 'refugio-das-nuvens'
const ROOM_NAME = 'Acomodação principal'

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function demoDates() {
  const today = isoDateInTimeZone(new Date())
  return { today, checkin: addDays(today, -1), checkout: addDays(today, 2) }
}

async function demoPousada() {
  const pousada = await getPousadaRepository().findBySlug(DEMO_SLUG)
  if (!pousada) throw new Error('Pousada de exemplo não encontrada.')
  return pousada
}

export async function demoMyStays(): Promise<MyStay[]> {
  const pousada = await demoPousada()
  const { checkin, checkout } = demoDates()
  return [
    {
      id: DEMO_STAY_ID,
      code: 'RP-DEMO',
      pousadaName: pousada.name,
      roomName: ROOM_NAME,
      checkin,
      checkout,
      status: 'checked_in',
    },
  ]
}

const DELIVERED_ORDER_TOTAL = 64

export async function demoStay(): Promise<{ stay: GuestStay; orders: GuestOrder[] }> {
  const pousada = await demoPousada()
  const { today, checkin, checkout } = demoDates()
  const nights = 3
  const stay = parseGuestStay({
    booking: {
      id: DEMO_STAY_ID,
      code: 'RP-DEMO',
      status: 'checked_in',
      checkin,
      checkout,
      adults: 2,
      children: 0,
      roomName: ROOM_NAME,
      total: pousada.pricePerNight * nights,
      balanceDue: pousada.pricePerNight,
      guestName: 'Mariana',
      roomAmenities: ['Lareira', 'Banheira', 'Wi-Fi', 'Varanda com vista'],
    },
    pousada: {
      id: pousada.id ?? DEMO_SLUG,
      name: pousada.name,
      slug: pousada.slug,
      image: pousada.image,
      address: pousada.address ?? '',
      city: pousada.city,
      state: pousada.state,
      cep: '',
      whatsapp: '',
      phone: '',
      checkinTime: pousada.checkinTime ?? '14:00',
      checkoutTime: pousada.checkoutTime ?? '12:00',
      houseRules: pousada.houseRules ?? 'Silêncio após as 22h.',
      cancellationPolicy:
        pousada.cancellationPolicy ?? 'Cancelamento sem custo até 7 dias antes do check-in.',
    },
    info: {
      wifiName: 'Refugio',
      wifiPassword: 'nuvens2026',
      guestInfo: 'Café servido no salão principal. Lenha extra é só pedir pelo app.',
      ordersHours: '08:00-22:00',
      breakfastInfo: '8h às 10h30',
      parkingInfo: 'Vaga coberta ao lado do chalé.',
      facilities: [
        { name: 'Piscina aquecida', hours: '9h às 21h' },
        { name: 'Sauna', hours: '17h às 22h' },
      ],
      dailyAgenda: [
        { time: '08:00', title: 'Café da manhã', note: 'Salão principal' },
        { time: '18:00', title: 'Fogueira', note: 'Deck' },
      ],
      localTips: [
        { name: 'Pico do Selado', kind: 'Trilha', distance: '6 km' },
        { name: 'Empório da Serra', kind: 'Restaurante', distance: '2 km' },
        { name: 'Cachoeira do Retiro', kind: 'Cachoeira', distance: '9 km' },
      ],
      emergency: [],
    },
    today,
    canOrder: true,
    ordersEnabled: true,
    canReview: true,
    reviewed: false,
    consumption: { delivered: DELIVERED_ORDER_TOTAL, open: 0, paid: 0 },
    menu: [
      menuItem(demoId('a1'), 'Vinho tinto da serra', 'bebidas', 'garrafa', 89, 'Cabernet local', 4),
      menuItem(
        demoId('a2'),
        'Tábua de queijos',
        'alimentos',
        'porção',
        64,
        'Queijos da Mantiqueira',
        3,
      ),
      menuItem(demoId('a3'), 'Água com gás', 'frigobar', 'garrafa', 6, '', 10),
      menuItem(
        demoId('a4'),
        'Café na cama',
        'cafe_da_manha',
        'bandeja',
        48,
        'Pães, frutas e café coado',
        2,
      ),
      menuItem(demoId('a5'), 'Lenha extra', 'servicos', 'feixe', 0, '', 2),
      menuItem(demoId('a6'), 'Toalha extra', 'enxoval', 'unidade', 0, '', 4),
    ],
  })

  const deliveredAt = `${today}T21:10:00.000Z`
  const orders: GuestOrder[] = [
    {
      id: demoId('b1'),
      bookingId: DEMO_STAY_ID,
      bookingCode: 'RP-DEMO',
      guestName: 'Mariana',
      roomName: ROOM_NAME,
      status: 'entregue',
      source: 'hospede',
      note: '',
      total: DELIVERED_ORDER_TOTAL,
      lines: [
        {
          itemId: demoId('a2'),
          name: 'Tábua de queijos',
          unit: 'porção',
          unitPrice: DELIVERED_ORDER_TOTAL,
          quantity: 1,
          lineTotal: DELIVERED_ORDER_TOTAL,
        },
      ],
      createdAt: `${today}T20:40:00.000Z`,
      acceptedAt: `${today}T20:45:00.000Z`,
      deliveredAt,
      cancelledAt: null,
      cancelReason: null,
    },
  ]
  return { stay, orders }
}

function menuItem(
  id: string,
  name: string,
  category: string,
  unit: string,
  price: number,
  description: string,
  maxQuantity: number,
) {
  return {
    id,
    name,
    category,
    unit,
    price,
    description,
    photoUrl: null,
    available: true,
    maxQuantity,
  }
}
