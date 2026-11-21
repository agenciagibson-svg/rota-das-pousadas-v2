import { NextResponse } from 'next/server'
import { getMyAppState } from '@/features/app-fases/services/app-phase.service'
import { offerCard, phaseCard } from '@/features/app-fases/phase'
import { listMyActiveOffers } from '@/features/ofertas/services/offers.service'

/**
 * Cartão da fase do app para a loja (home): estadia, viagem marcada,
 * pós-estadia, pagamento pendente ou, sem nada disso, oferta recebida (0111). Sessão via cookie; nunca em cache.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const card = phaseCard(await getMyAppState()) ?? offerCard(await listMyActiveOffers())
    return NextResponse.json({ card }, { headers })
  } catch {
    // O cartão nunca derruba a loja: sem dados, não aparece.
    return NextResponse.json({ card: null }, { headers })
  }
}
