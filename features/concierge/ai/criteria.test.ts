import { describe, expect, it } from 'vitest'
import { extractCriteria } from './criteria'

const TODAY = '2026-10-13' // terça-feira

describe('extractCriteria — entende o que a pessoa escreveu', () => {
  it('reconhece palavras-chave e sinônimos sem acento', () => {
    const c = extractCriteria(['quero praia com a familia e o cachorro'], TODAY)
    expect(c.intents).toEqual(expect.arrayContaining(['praia', 'familia', 'pets']))
  })

  it('verão, floresta, cabana e resort viram intenções', () => {
    expect(extractCriteria(['algo no verão'], TODAY).intents).toContain('verao')
    expect(extractCriteria(['uma cabana na floresta'], TODAY).intents).toEqual(
      expect.arrayContaining(['cabana', 'floresta']),
    )
    expect(extractCriteria(['resort tudo incluso'], TODAY).intents).toContain('resort')
  })

  it('conta pessoas: números, casal e crianças somadas', () => {
    expect(extractCriteria(['somos 4 pessoas'], TODAY).guests).toBe(4)
    expect(extractCriteria(['vou com minha esposa, só o casal'], TODAY).guests).toBe(2)
    expect(extractCriteria(['2 adultos e 2 crianças'], TODAY).guests).toBe(4)
    expect(extractCriteria(['seremos três'], TODAY).guests).toBe(3)
    expect(extractCriteria(['praia'], TODAY).guests).toBeNull()
  })

  it('a resposta mais recente vence (mudou de ideia sobre pessoas)', () => {
    expect(extractCriteria(['somos 2', 'na verdade 5 pessoas'], TODAY).guests).toBe(5)
  })

  it('lê datas dd/mm, intervalos e escolhe o próximo ano quando já passou', () => {
    expect(extractCriteria(['de 20/12 a 23/12'], TODAY).dates).toEqual({
      checkin: '2026-12-20',
      checkout: '2026-12-23',
    })
    expect(extractCriteria(['20 a 23/01'], TODAY).dates).toEqual({
      checkin: '2027-01-20',
      checkout: '2027-01-23',
    })
  })

  it('fim de semana vira sexta a domingo; noites soltas ficam guardadas', () => {
    expect(extractCriteria(['um fim de semana'], TODAY).dates).toEqual({
      checkin: '2026-10-16',
      checkout: '2026-10-18',
    })
    const c = extractCriteria(['3 noites'], TODAY)
    expect(c.nights).toBe(3)
    expect(c.dates).toBeNull()
  })

  it('orçamento e destino', () => {
    expect(extractCriteria(['até R$ 600 a diária'], TODAY).maxPrice).toBe(600)
    expect(extractCriteria(['algo baratinho'], TODAY).maxPrice).toBe(450)
    expect(extractCriteria(['no nordeste'], TODAY).states).toEqual(['BA', 'AL', 'PE', 'CE', 'RN'])
    expect(extractCriteria(['em Minas'], TODAY).states).toEqual(['MG'])
  })
})
