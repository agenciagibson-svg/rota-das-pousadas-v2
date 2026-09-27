import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { listMyBookings } from '@/features/reservas/services/bookings.service'
import { buildHeaderSummary } from '@/features/auth/header-summary'

/**
 * Quem está logado + viagens pendentes, para o cabeçalho do site. Sessão via
 * cookie e RLS (o hóspede só lê as próprias reservas). Nunca em cache.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const user = await getCurrentUser()
    const bookings = user ? await listMyBookings() : []
    return NextResponse.json(buildHeaderSummary(user, bookings), { headers })
  } catch {
    // Cabeçalho nunca pode derrubar a página: sem dados, mostra "Entrar".
    return NextResponse.json({ user: null }, { headers })
  }
}
