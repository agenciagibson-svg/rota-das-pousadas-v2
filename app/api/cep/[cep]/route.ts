import { NextResponse, type NextRequest } from 'next/server'
import { lookupCep } from '@/lib/cep'
import { getCurrentUser } from '@/server/queries'

/**
 * Busca de endereço pelo CEP para o formulário de cadastro. Só para usuário
 * logado (evita virar proxy público de consulta). 200 com o endereço, 404 se
 * o CEP não existe, 503 se os serviços de CEP estão fora do ar.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ cep: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { cep } = await params
  const result = await lookupCep(cep)
  if (result === 'unavailable') {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
  if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=86400' } })
}
