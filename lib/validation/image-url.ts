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
