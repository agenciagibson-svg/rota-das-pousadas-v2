import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Isolamento de dados (0084): `anon`/`authenticated` só leem as colunas da
 * vitrine de `pousadas` e as colunas públicas de `reviews`. Uma consulta que
 * peça `*` ou uma coluna privada é recusada pelo banco em produção — e quebra
 * a página. Este teste pega isso antes do deploy.
 *
 * Colunas privadas são lidas só pelas RPCs `get_pousada_private_settings` e
 * `list_pousada_reviews`, que conferem quem está pedindo.
 */
const ROOTS = ['repositories', 'features', 'server', 'app', 'lib'].map((d) =>
  join(process.cwd(), d),
)

const PRIVATE: Record<string, string[]> = {
  pousadas: ['owner_id', 'notification_email', 'legal_name', 'tax_id'],
  reviews: ['author_id', 'booking_id'],
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (name === 'node_modules') return []
    if (statSync(full).isDirectory()) return sources(full)
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) return []
    return [full]
  })
}

/** Trechos `.from('<tabela>')` seguidos do `.select(...)` da mesma cadeia. */
function selectsOf(code: string, table: string): string[] {
  const out: string[] = []
  const re = new RegExp(`\\.from\\('${table}'\\)\\s*\\.select\\(\\s*([^)]*)\\)`, 'g')
  for (const m of code.matchAll(re)) out.push(m[1])
  return out
}

describe('colunas privadas fora da leitura direta', () => {
  const files = ROOTS.flatMap(sources)

  for (const [table, cols] of Object.entries(PRIVATE)) {
    it(`nenhum select direto em ${table} pede * ou coluna privada`, () => {
      const offenders: string[] = []
      for (const file of files) {
        const code = readFileSync(file, 'utf8')
        for (const sel of selectsOf(code, table)) {
          const bad = /['"`]\s*\*/.test(sel) || cols.some((c) => new RegExp(`\\b${c}\\b`).test(sel))
          if (bad) offenders.push(`${relative(process.cwd(), file)}: select(${sel.trim()})`)
        }
      }
      expect(offenders).toEqual([])
    })
  }
})

/**
 * 0085: a RLS de `bookings` é só da equipe. Consulta direta filtrando pelo
 * hóspede (`.eq('guest_id', …)`) volta vazia em produção — o hóspede lê a
 * própria reserva pela RPC `list_my_bookings` (`listMyBookingRows`).
 */
describe('hóspede lê reserva só pela RPC', () => {
  it('nenhuma consulta direta filtra bookings por guest_id', () => {
    const offenders = ROOTS.flatMap(sources).filter((file) =>
      /\.eq\(\s*'guest_id'/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders.map((f) => relative(process.cwd(), f))).toEqual([])
  })
})
