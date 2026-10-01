import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createAction, userMessage } from './create-action'

describe('createAction', () => {
  const schema = z.object({ name: z.string().min(2, 'Nome curto') })

  it('validação vira fieldErrors', async () => {
    const action = createAction(schema, async () => 1)
    const r = await action({ name: 'a' })
    expect(r).toEqual({ ok: false, error: 'Dados inválidos.', fieldErrors: { name: 'Nome curto' } })
  })

  it('mensagem em português da regra de negócio chega à tela e o erro é logado', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const action = createAction(schema, async () => {
      throw new Error('Quarto indisponível nessas datas.')
    })
    const r = await action({ name: 'Ana' })
    expect(r).toMatchObject({ ok: false, error: 'Quarto indisponível nessas datas.' })
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it('erro técnico do banco (inclusive PostgrestError) vira mensagem genérica', () => {
    expect(userMessage(new Error('duplicate key value violates unique constraint "x"'))).toMatch(
      /Não foi possível concluir/,
    )
    expect(
      userMessage({ message: 'new row violates row-level security policy', code: '42501' }),
    ).toMatch(/Não foi possível concluir/)
    expect(
      userMessage({ message: 'O check-in só pode ser feito a partir do dia da chegada.' }),
    ).toBe('O check-in só pode ser feito a partir do dia da chegada.')
  })
})
