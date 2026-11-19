import { describe, expect, it } from 'vitest'
import { contractAcceptedEmail, formatAcceptedAt } from './contract-email'

const BASE = {
  pousadaName: 'Pousada <Exemplo> & Cia',
  acceptedByName: 'Pessoa de Teste',
  acceptedByEmail: 'pessoa@example.test',
  versionTitle: 'Contrato de teste',
  versionCode: 'teste-v1',
  acceptedAt: '2026-12-02T15:04:00Z',
  sha256: 'a'.repeat(64),
  body: '# Contrato\n\nCláusula <b>1</b>.\n\n## Segunda parte\nTexto final.',
  panelUrl: 'https://rotadaspousadas.com.br/dashboard/configuracoes/contrato',
}

describe('contractAcceptedEmail', () => {
  it('data e hora no horário de Brasília', () => {
    expect(formatAcceptedAt('2026-12-02T15:04:00Z')).toBe('02/12/2026, 12:04')
    expect(formatAcceptedAt('não é data')).toBe('não é data')
  })

  it('leva o texto inteiro, quem aceitou, quando e o código de conferência', () => {
    const email = contractAcceptedEmail({ ...BASE, recipient: 'owner' })
    expect(email.subject).toBe('Contrato aceito — Pousada <Exemplo> & Cia')
    expect(email.text).toContain(BASE.body)
    expect(email.text).toContain('Aceito por: Pessoa de Teste (pessoa@example.test)')
    expect(email.text).toContain('02/12/2026, 12:04 (horário de Brasília)')
    expect(email.text).toContain(`Código de conferência: ${BASE.sha256}`)
    expect(email.html).toContain('Texto final.')
    expect(email.html).toContain(BASE.sha256)
    expect(email.html).toContain('Você aceitou o contrato')
  })

  it('escapa o que vem da pousada e do contrato', () => {
    const email = contractAcceptedEmail({ ...BASE, recipient: 'owner' })
    expect(email.html).toContain('Pousada &lt;Exemplo&gt; &amp; Cia')
    expect(email.html).toContain('Cláusula &lt;b&gt;1&lt;/b&gt;.')
    expect(email.html).not.toContain('<b>1</b>')
  })

  it('a cópia da Rota muda só a abertura', () => {
    const email = contractAcceptedEmail({ ...BASE, recipient: 'rota' })
    expect(email.html).toContain('aceitou o contrato.')
    expect(email.html).not.toContain('Você aceitou o contrato')
    expect(email.text).toContain(BASE.body)
  })
})
