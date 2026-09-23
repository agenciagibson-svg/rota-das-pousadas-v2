import type { BookingOrigin } from '@/features/reservas/types'

export const ORIGIN_LABEL: Record<BookingOrigin, string> = {
  rota_das_pousadas: 'Rota das Pousadas',
  site_proprio: 'Site próprio',
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  balcao: 'Balcão',
  booking_com: 'Booking.com',
  airbnb: 'Airbnb',
  expedia: 'Expedia',
  agencia: 'Agência',
  outro: 'Outro',
  link_bio: 'Link da bio',
}
