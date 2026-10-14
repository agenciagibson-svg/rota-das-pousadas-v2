import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A CSP estrita de `proxy.ts` usa um nonce por requisição. Página
 * pré-renderizada no build sai sem nonce e o navegador bloqueia os scripts do
 * próprio Next — foi o que aconteceu com /termos e /privacidade.
 *
 * Este teste não roda o build: confere, arquivo por arquivo, que toda página
 * tem algum sinal de renderização por requisição. Página nova só com texto
 * precisa de `export const dynamic = 'force-dynamic'`.
 */
const APP_DIR = join(process.cwd(), 'app')

const DYNAMIC_SIGNALS = [
  /export const dynamic = 'force-dynamic'/,
  /searchParams/,
  /await params/,
  /getCurrentUser|requireOwnerDashboard|requireAdmin/,
  /\b(cookies|headers)\(\)/,
  /await connection\(\)/,
]

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return pages(full)
    return name === 'page.tsx' ? [full] : []
  })
}

describe('páginas do app', () => {
  it('nenhuma é pré-renderizada sem nonce', () => {
    const staticPages = pages(APP_DIR)
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        return !DYNAMIC_SIGNALS.some((signal) => signal.test(source))
      })
      .map((file) => relative(process.cwd(), file))
    expect(staticPages).toEqual([])
  })
})
