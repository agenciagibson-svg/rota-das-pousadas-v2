import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import './zod-pt'

const first = (schema: z.ZodTypeAny, value: unknown) => {
  const result = schema.safeParse(value)
  return result.success ? null : result.error.issues[0].message
}

describe('mensagens padrão do Zod em português', () => {
  it('regra sem mensagem própria sai em português', () => {
    expect(first(z.number().max(50), 80)).toBe('O máximo é 50.')
    expect(first(z.number().min(1), 0)).toBe('O mínimo é 1.')
    expect(first(z.string().uuid(), 'abc')).toBe('Seleção inválida.')
    expect(first(z.string().email(), 'abc')).toBe('E-mail inválido.')
    expect(first(z.string().min(1), '')).toBe('Campo obrigatório.')
    expect(first(z.string().min(3), 'ab')).toBe('Use pelo menos 3 caracteres.')
    expect(first(z.string().max(5), 'abcdefg')).toBe('Use no máximo 5 caracteres.')
    expect(first(z.object({ nome: z.string() }), {})).toBe('Campo obrigatório.')
    expect(first(z.coerce.number(), 'abc')).toBe('Informe um número.')
    expect(first(z.enum(['a', 'b']), 'c')).toBe('Escolha uma das opções.')
    expect(first(z.array(z.string()).min(1), [])).toBe('Informe pelo menos 1 item.')
  })

  it('mensagem escrita no schema continua valendo', () => {
    expect(first(z.string().min(2, 'Informe o nome.'), 'a')).toBe('Informe o nome.')
    expect(
      first(
        z.string().refine(() => false, 'CPF inválido.'),
        'x',
      ),
    ).toBe('CPF inválido.')
  })

  it('nenhuma mensagem padrão fica em inglês', () => {
    const samples: [z.ZodTypeAny, unknown][] = [
      [z.string(), 1],
      [z.number().int(), 1.5],
      [z.number().positive(), -1],
      [z.string().regex(/^a$/), 'b'],
      [z.string().url(), 'x'],
      [z.date(), new Date('x')],
      [z.boolean(), 'sim'],
      [z.number().multipleOf(5), 3],
      [z.literal('a'), 'b'],
      [z.union([z.string(), z.number()]), true],
    ]
    for (const [schema, value] of samples) {
      const message = first(schema, value)
      expect(message, JSON.stringify(value)).toBeTruthy()
      expect(message).not.toMatch(/\b(must|invalid|expected|required|received|should)\b/i)
    }
  })
})

describe('formulários com validação no navegador', () => {
  // O mapa de mensagens é registrado por import. Quem usa `zodResolver` roda os
  // schemas no navegador e precisa importar `@/lib/validation/zod-pt`.
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      if (name === 'node_modules' || name.startsWith('.')) return []
      const full = join(dir, name)
      if (statSync(full).isDirectory()) return sources(full)
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
    })
  }

  it('todo arquivo que usa zodResolver importa as mensagens em português', () => {
    const root = process.cwd()
    const missing = ['app', 'components', 'features']
      .flatMap((dir) => sources(join(root, dir)))
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        return source.includes('zodResolver(') && !source.includes("'@/lib/validation/zod-pt'")
      })
      .map((file) => relative(root, file))
    expect(missing).toEqual([])
  })
})
