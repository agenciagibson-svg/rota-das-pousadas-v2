import 'server-only'
import { z } from 'zod'
import type { Pousada } from '@/types'
import { localConcierge } from './local-engine'
import { DEFAULT_OPENAI_MODEL, openaiConcierge } from './openai-engine'
import type { ConciergeReply } from './types'

/** Corpo aceito pela rota: conversa curta, só texto. */
export const conciergeRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(800),
      }),
    )
    .min(1)
    .max(20)
    .refine((list) => list.at(-1)?.role === 'user', 'A última mensagem deve ser do hóspede.'),
})

export type ConciergeRequest = z.infer<typeof conciergeRequestSchema>

/**
 * Escolhe o motor: ChatGPT quando há `OPENAI_API_KEY`; senão (ou se a OpenAI
 * falhar — cota, rede, timeout), o motor local responde. A conversa nunca
 * quebra por causa da IA.
 */
export async function respondConcierge({
  messages,
  pousadas,
  today,
  apiKey,
  model,
  fetchImpl,
}: ConciergeRequest & {
  pousadas: Pousada[]
  today: string
  apiKey?: string
  model?: string
  fetchImpl?: typeof fetch
}): Promise<ConciergeReply> {
  if (apiKey) {
    try {
      return await openaiConcierge({
        messages,
        pousadas,
        today,
        apiKey,
        model: model || DEFAULT_OPENAI_MODEL,
        fetchImpl,
      })
    } catch (error) {
      console.warn(
        '[concierge] OpenAI indisponível; usando o modo local.',
        String(error).slice(0, 300),
      )
    }
  }
  return localConcierge(messages, pousadas, today)
}

/**
 * Limite simples por IP, em memória (por instância). Segura abuso casual da
 * cota da OpenAI; não substitui um limite distribuído.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>()
  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= limit) {
      hits.set(key, recent)
      return false
    }
    recent.push(now)
    hits.set(key, recent)
    if (hits.size > 5000) {
      for (const [k, list] of hits) if (!list.some((t) => now - t < windowMs)) hits.delete(k)
    }
    return true
  }
}
