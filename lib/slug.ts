// Marcas de acento combinantes (U+0300–U+036F) — construídas via string para
// manter o código-fonte ASCII e o comportamento previsível.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

/** Converte um texto em slug URL-safe (sem acentos, minúsculo, hifenizado). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Slug único: base + sufixo curto aleatório (evita colisão). */
export function uniqueSlug(input: string): string {
  const suffix = Math.random().toString(36).slice(2, 6)
  const base = slugify(input) || 'pousada'
  return `${base}-${suffix}`
}
