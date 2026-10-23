/**
 * Imagem gravada no cadastro: caminho do próprio site (ex.: `/placeholder.svg`)
 * ou URL http(s). Sem `//` nem `\` no início do caminho, que o navegador
 * trataria como outro domínio. Vazio só é aceito quando `allowEmpty`.
 */
export function isStoredImageUrl(value: string, allowEmpty = true): boolean {
  if (value === '') return allowEmpty
  if (/^\/(?![/\\])[^\s\\]*$/.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Caminho público do bucket `pousadas` no Supabase Storage (upload do painel). */
export const POUSADAS_BUCKET_PATH = '/storage/v1/object/public/pousadas/'

/**
 * Foto enviada pelo painel (acomodações): só o bucket `pousadas` do Storage ou
 * um caminho do próprio site. Endereço de outro site é recusado — a foto
 * aparece na página pública com `next/image`, que só otimiza o bucket, e o
 * cadastro não deve virar um jeito de apontar para qualquer servidor.
 */
export function isUploadedPhotoUrl(value: string): boolean {
  if (/^\/(?![/\\])[^\s\\]*$/.test(value)) return !value.startsWith('/api/')
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    if (!url.pathname.startsWith(POUSADAS_BUCKET_PATH) || url.pathname.includes('/../')) return false
    const storage = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    if (!storage) return true
    try {
      return new URL(storage).host === url.host
    } catch {
      return true
    }
  } catch {
    return false
  }
}
