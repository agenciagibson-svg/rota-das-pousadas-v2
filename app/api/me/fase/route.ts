import { NextResponse } from 'next/server'
import { getMyAppState } from '@/features/app-fases/services/app-phase.service'
import { phaseCard } from '@/features/app-fases/phase'

/**
 * Cartão da fase do app para a loja (home): estadia, viagem marcada,
 * pós-estadia ou pagamento pendente. Sessão via cookie; nunca em cache.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    return NextResponse.json({ card: phaseCard(await getMyAppState()) }, { headers })
  } catch {
    // O cartão nunca derruba a loja: sem dados, não aparece.
    return NextResponse.json({ card: null }, { headers })
  }
}
