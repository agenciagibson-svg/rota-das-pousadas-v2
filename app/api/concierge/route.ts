import { NextResponse, type NextRequest } from 'next/server'
import { isoDateInTimeZone } from '@/lib/dates'
import {
  conciergeRequestSchema,
  createRateLimiter,
  respondConcierge,
} from '@/features/concierge/ai/respond'
import { getPousadas } from '@/server/queries'

/**
 * Conversa do concierge. ChatGPT quando `OPENAI_API_KEY` está configurada na
 * Vercel; modo local (palavras-chave) sem a chave ou se a OpenAI falhar.
 * A chave fica só no servidor — nunca vai para o navegador.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const allow = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 })

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'anon'
  if (!allow(ip)) {
    return NextResponse.json(
      { error: 'Muitas mensagens em pouco tempo. Respire e tente de novo em alguns minutos.' },
      { status: 429 },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = conciergeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Mensagem inválida.' }, { status: 400 })
  }

  const { items } = await getPousadas({ pageSize: 100 })
  const reply = await respondConcierge({
    messages: parsed.data.messages,
    pousadas: items,
    today: isoDateInTimeZone(new Date()),
    apiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    model: process.env.OPENAI_MODEL?.trim() || undefined,
  })
  return NextResponse.json(reply, { headers: { 'Cache-Control': 'no-store' } })
}
