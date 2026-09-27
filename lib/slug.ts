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

/**
 * Caminhos que a aplicação já usa na raiz.
 *
 * A página da bio mora em `/<slug>`, então um slug igual a um destes seria
 * engolido pela rota estática e o link da bio da pousada simplesmente nunca
 * abriria — sem erro, sem aviso, só a tela errada. Toda criação de slug precisa
 * passar por `isReservedSlug`, e novos caminhos de primeiro nível precisam ser
 * acrescentados aqui no mesmo commit em que forem criados.
 */
export const RESERVED_SLUGS: readonly string[] = [
  'admin',
  'anunciar',
  'api',
  'auth',
  'cadastro',
  'concierge',
  'conta',
  'dashboard',
  'esqueci-senha',
  'destinos',
  'experiencias',
  'favoritos',
  'login',
  'redefinir-senha',
  'logout',
  'minhas-reservas',
  'parceiros',
  'pousada',
  'pousadas',
  'privacidade',
  'sobre',
  'suporte',
  'termos',
  'sitemap',
  'robots',
  'manifest',
  '_next',
  'static',
  'public',
] as const

const RESERVED = new Set<string>(RESERVED_SLUGS)

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.trim().toLowerCase())
}
