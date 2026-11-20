import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/** 0107: ajuste do envio automático e histórico de envios do guia de links. */

export const WELCOME_GUIDE_AUTO_KEY = 'welcome_guide_auto'

export type { WelcomeGuideSend } from '@/features/admin/types'
import type { WelcomeGuideSend } from '@/features/admin/types'

/** Envio automático ligado? Sem a linha (ou sem a tabela), desligado. */
export async function getWelcomeGuideAuto(): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', WELCOME_GUIDE_AUTO_KEY)
    .maybeSingle()
  if (error) throw error
  return data?.value === true
}

export async function setWelcomeGuideAuto(enabled: boolean, userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('platform_settings').upsert({
    key: WELCOME_GUIDE_AUTO_KEY,
    value: enabled,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  })
  if (error) throw error
}

export async function insertWelcomeGuideSend(input: {
  pousadaId: string
  channel: 'email' | 'whatsapp'
  trigger: 'auto' | 'manual'
  recipientDomain: string | null
  sentBy: string
}): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('pousada_welcome_guide_sends').insert({
    pousada_id: input.pousadaId,
    channel: input.channel,
    trigger: input.trigger,
    recipient_domain: input.recipientDomain,
    sent_by: input.sentBy,
  })
  if (error) throw error
}

/** Último envio de cada pousada (mapa pousadaId → envio). */
export async function lastWelcomeGuideSends(): Promise<Map<string, WelcomeGuideSend>> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousada_welcome_guide_sends')
    .select('pousada_id, channel, trigger, sent_at')
    .order('sent_at', { ascending: false })
    .limit(2000)
  if (error) throw error
  const out = new Map<string, WelcomeGuideSend>()
  for (const r of data ?? []) {
    if (out.has(r.pousada_id)) continue
    out.set(r.pousada_id, {
      pousadaId: r.pousada_id,
      channel: r.channel === 'whatsapp' ? 'whatsapp' : 'email',
      trigger: r.trigger === 'auto' ? 'auto' : 'manual',
      sentAt: r.sent_at,
    })
  }
  return out
}

export async function hasWelcomeGuideEmail(pousadaId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const { count, error } = await supabase
    .from('pousada_welcome_guide_sends')
    .select('id', { count: 'exact', head: true })
    .eq('pousada_id', pousadaId)
    .eq('channel', 'email')
  if (error) throw error
  return (count ?? 0) > 0
}

/** Dados da pousada para montar o guia (nome, slug, status, WhatsApp). */
export async function getPousadaForGuide(id: string): Promise<{
  name: string
  slug: string
  status: string
  whatsapp: string
} | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousadas')
    .select('name, slug, status, whatsapp')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
    ? { name: data.name, slug: data.slug, status: data.status, whatsapp: data.whatsapp ?? '' }
    : null
}
