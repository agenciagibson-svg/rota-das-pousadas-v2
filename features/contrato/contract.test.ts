import { describe, expect, it } from 'vitest'
import {
  contractNeedsAction,
  contractStatus,
  launchCondition,
  openBrackets,
  parseContractBody,
  unknownContractFields,
} from './contract'
import { acceptContractSchema, saveContractDraftSchema } from './schemas'
import type { ContractState } from './types'

const VERSION = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'teste-v1',
  title: 'Contrato de teste',
  publishedAt: '2026-12-01T12:00:00Z',
  requiresReaccept: true,
}
const ACCEPTANCE = {
  acceptedAt: '2026-12-02T12:00:00Z',
  acceptedByName: 'Pessoa de Teste',
  versionCode: 'teste-v0',
  versionTitle: 'Contrato antigo',
  sha256: 'a'.repeat(64),
}

function state(overrides: Partial<ContractState> = {}): ContractState {
  return {
    active: true,
    version: VERSION,
    canAccept: true,
    acceptedCurrent: false,
    latestAcceptance: null,
    body: 'texto',
    bodySha256: 'b'.repeat(64),
    missing: [],
    firstPublishedAt: null,
    founderRank: null,
    commissionExemptUntil: null,
    commissionRateLockedUntil: null,
    ...overrides,
  }
}

describe('contractStatus', () => {
  it('sem versão publicada o contrato fica inativo, mesmo com aceite antigo', () => {
    expect(contractStatus(state({ active: false, version: null }))).toBe('inactive')
    expect(contractNeedsAction(state({ active: false, version: null }))).toBe(false)
  })

  it('pendente quando a pousada nunca aceitou', () => {
    expect(contractStatus(state())).toBe('pending')
    expect(contractNeedsAction(state())).toBe(true)
  })

  it('aceito quando a versão vigente foi aceita', () => {
    const s = state({ acceptedCurrent: true, latestAcceptance: ACCEPTANCE, body: null })
    expect(contractStatus(s)).toBe('accepted')
    expect(contractNeedsAction(s)).toBe(false)
  })

  it('versão nova pede novo aceite só quando ela exige', () => {
    const s = state({ latestAcceptance: ACCEPTANCE })
    expect(contractStatus(s)).toBe('reaccept')
    expect(contractNeedsAction(s)).toBe(true)
    const optional = state({
      latestAcceptance: ACCEPTANCE,
      version: { ...VERSION, requiresReaccept: false },
    })
    expect(contractStatus(optional)).toBe('reaccept')
    expect(contractNeedsAction(optional)).toBe(false)
  })
})

describe('launchCondition', () => {
  const now = new Date('2026-12-10T12:00:00Z')

  it('não existe para quem não é fundadora', () => {
    expect(launchCondition(state(), now)).toBeNull()
  })

  it('conta os dias que faltam, arredondando para cima', () => {
    const s = state({
      founderRank: 7,
      commissionExemptUntil: '2026-12-12T13:00:00Z',
      commissionRateLockedUntil: '2027-10-13T13:00:00Z',
    })
    expect(launchCondition(s, now)).toEqual({
      rank: 7,
      exemptUntil: '2026-12-12T13:00:00Z',
      exemptDaysLeft: 3,
      exemptActive: true,
      rateLockedUntil: '2027-10-13T13:00:00Z',
    })
  })

  it('depois do prazo a isenção acabou e não fica negativa', () => {
    const s = state({ founderRank: 1, commissionExemptUntil: '2026-12-01T00:00:00Z' })
    const launch = launchCondition(s, now)
    expect(launch?.exemptActive).toBe(false)
    expect(launch?.exemptDaysLeft).toBe(0)
  })
})

describe('modelo do contrato', () => {
  it('aponta campo desconhecido e ignora os conhecidos', () => {
    const template = 'Pousada {{razao_social}}, {{documento}}, {{cnpj}} e {{ nome }}. {{cnpj}}'
    expect(unknownContractFields(template)).toEqual(['{{cnpj}}', '{{ nome }}'])
    expect(unknownContractFields('{{endereco}} {{representante_nome}}')).toEqual([])
  })

  it('aponta trechos entre colchetes por definir', () => {
    expect(openBrackets('vence no dia [10] e multa de [2%]; [10] de novo')).toEqual([
      '[10]',
      '[2%]',
    ])
    expect(openBrackets('sem pendências')).toEqual([])
  })

  it('quebra o texto em títulos e parágrafos', () => {
    const body =
      '# Contrato\n\nPrimeira linha\nsegunda linha.\n\n## Cláusula 1\n1.1. Texto.\n\n\n1.2. Outro.'
    expect(parseContractBody(body)).toEqual([
      { kind: 'heading', text: 'Contrato' },
      { kind: 'paragraph', text: 'Primeira linha segunda linha.' },
      { kind: 'heading', text: 'Cláusula 1' },
      { kind: 'paragraph', text: '1.1. Texto.' },
      { kind: 'paragraph', text: '1.2. Outro.' },
    ])
  })

  it('texto vazio não gera blocos', () => {
    expect(parseContractBody('  \n\n ')).toEqual([])
  })
})

describe('schemas', () => {
  const valid = { versionId: VERSION.id, bodySha256: 'c'.repeat(64), confirm: true }

  it('aceite exige a caixa marcada e o hash do texto', () => {
    expect(acceptContractSchema.safeParse(valid).success).toBe(true)
    expect(acceptContractSchema.safeParse({ ...valid, confirm: false }).success).toBe(false)
    expect(acceptContractSchema.safeParse({ ...valid, bodySha256: 'xyz' }).success).toBe(false)
    expect(acceptContractSchema.safeParse({ ...valid, versionId: 'abc' }).success).toBe(false)
  })

  it('rascunho recusa código inválido e texto curto', () => {
    const draft = {
      code: '2026-12-v1',
      title: 'Contrato',
      bodyTemplate: 'x'.repeat(200),
      requiresReaccept: true,
    }
    expect(saveContractDraftSchema.safeParse(draft).success).toBe(true)
    expect(saveContractDraftSchema.safeParse({ ...draft, code: 'Versão 1' }).success).toBe(false)
    expect(saveContractDraftSchema.safeParse({ ...draft, bodyTemplate: 'curto' }).success).toBe(
      false,
    )
  })
})
