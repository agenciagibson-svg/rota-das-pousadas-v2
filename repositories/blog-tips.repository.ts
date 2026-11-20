import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseStaticClient } from '@/lib/supabase/static'
import type { BlogTip, BlogTipForReview, BlogTipStatus } from '@/features/blog/types'

/**
 * 0108: dicas dos leitores nos guias. Público lê só as aprovadas (RLS); envio
 * por `submit_blog_tip` e moderação por `moderate_blog_tip`. As fotos ficam no
 * bucket privado `blog-tips` e saem por URL assinada.
 */

const BUCKET = 'blog-tips'
const SIGNED_URL_SECONDS = 60 * 60 * 24

type TipRow = {
  id: string
  post_slug: string
  author_name: string
  author_city: string | null
  body: string
  photo_path: string | null
  created_at: string
  status?: string
}

async function signedUrls(
  supabase: SupabaseClient<Database>,
  paths: string[],
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS)
  if (error) return new Map()
  return new Map(
    (data ?? []).flatMap((item) =>
      item.path && item.signedUrl && !item.error ? [[item.path, item.signedUrl] as const] : [],
    ),
  )
}

function toTip(row: TipRow, urls: Map<string, string>): BlogTip {
  return {
    id: row.id,
    authorName: row.author_name,
    authorCity: row.author_city,
    body: row.body,
    photoUrl: row.photo_path ? (urls.get(row.photo_path) ?? null) : null,
    createdAt: row.created_at,
  }
}

/**
 * Sem Supabase (desenvolvimento e versão de teste com dados de exemplo): duas
 * dicas de exemplo, para ver como o bloco fica no guia.
 */
const EXAMPLE_TIPS: BlogTip[] = [
  {
    id: 'exemplo-1',
    authorName: 'Leitora de exemplo',
    authorCity: 'Uberlândia',
    body: 'Chegue cedo: antes das 9h a cachoeira fica praticamente vazia e a luz é linda para foto. Leve lanche, porque a lanchonete abre mais tarde.',
    photoUrl:
      'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1200&q=80',
    createdAt: '2026-11-18T12:00:00Z',
  },
  {
    id: 'exemplo-2',
    authorName: 'Leitor de exemplo',
    authorCity: null,
    body: 'Fomos de carro baixo na seca e deu tudo certo, mas depois de chuva o barro complica. Vale perguntar na pousada antes de sair.',
    photoUrl: null,
    createdAt: '2026-11-15T12:00:00Z',
  },
]

export async function listApprovedTips(postSlug: string): Promise<BlogTip[]> {
  if (!isSupabaseConfigured()) return EXAMPLE_TIPS
  const supabase = createSupabaseStaticClient()
  const { data, error } = await supabase
    .from('blog_tips')
    .select('id, post_slug, author_name, author_city, body, photo_path, created_at')
    .eq('post_slug', postSlug)
    .eq('status', 'aprovada')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  const rows = (data ?? []) as TipRow[]
  const urls = await signedUrls(
    supabase,
    rows.flatMap((r) => (r.photo_path ? [r.photo_path] : [])),
  )
  return rows.map((r) => toTip(r, urls))
}

export async function submitTip(input: {
  postSlug: string
  authorName: string
  authorCity: string
  body: string
  photo: Blob | null
  consent: boolean
}): Promise<{ id: string; photoSaved: boolean }> {
  if (!isSupabaseConfigured()) return { id: 'exemplo', photoSaved: Boolean(input.photo) }
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('submit_blog_tip', {
    p_post_slug: input.postSlug,
    p_author_name: input.authorName,
    p_author_city: input.authorCity,
    p_body: input.body,
    p_with_photo: Boolean(input.photo),
    p_consent: input.consent,
  })
  if (error) throw error
  const result = data as { id: string; photo_path: string | null }
  if (!input.photo || !result.photo_path) return { id: result.id, photoSaved: false }
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(result.photo_path, input.photo, { contentType: 'image/jpeg', upsert: false })
  return { id: result.id, photoSaved: !upload.error }
}

export async function listTipsForReview(): Promise<BlogTipForReview[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('blog_tips')
    .select('id, post_slug, author_name, author_city, body, photo_path, created_at, status')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  const rows = (data ?? []) as TipRow[]
  const urls = await signedUrls(
    supabase,
    rows.flatMap((r) => (r.photo_path ? [r.photo_path] : [])),
  )
  return rows.map((r) => ({
    ...toTip(r, urls),
    postSlug: r.post_slug,
    status: (r.status ?? 'pendente') as BlogTipStatus,
    photoMissing: Boolean(r.photo_path) && !urls.has(r.photo_path!),
  }))
}

export async function moderateTip(id: string, status: 'aprovada' | 'recusada'): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('moderate_blog_tip', { p_id: id, p_status: status })
  if (error) throw error
  if (status === 'recusada') {
    // Foto recusada não fica guardada.
    await supabase.storage.from(BUCKET).remove([`dicas/${id}.jpg`])
  }
}
