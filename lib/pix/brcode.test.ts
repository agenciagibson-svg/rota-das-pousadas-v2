import { describe, expect, it } from 'vitest'
import { brCodeText, buildPixCopiaECola, crc16, normalizePixKey } from './brcode'

describe('BR Code (Pix copia e cola)', () => {
  it('CRC16/CCITT-FALSE confere com o valor de referência', () => {
    expect(crc16('123456789')).toBe('29B1')
  })
  it('monta o código com chave, valor, nome, cidade e identificação', () => {
    const code = buildPixCopiaECola({
      keyType: 'email',
      key: 'Pousada@Exemplo.com',
      merchantName: 'Refúgio das Nuvens',
      merchantCity: 'Monte Verde',
      amount: 1440,
      txid: 'RP-6F4AA5',
    })
    // Conferido contra a biblioteca de referência pix-utils (parse válido).
    expect(code).toBe(
      '00020126410014br.gov.bcb.pix0119pousada@exemplo.com52040000530398654071440.005802BR5918REFUGIO DAS NUVENS6011MONTE VERDE62120508RP6F4AA563049F32',
    )
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)))
  })
  it('normaliza chaves', () => {
    expect(normalizePixKey('telefone', '(34) 91234-5678')).toBe('+5534912345678')
    expect(normalizePixKey('cpf', '529.982.247-25')).toBe('52998224725')
    expect(normalizePixKey('cnpj', '11.222.333/0001-81')).toBe('11222333000181')
  })
  it('limpa acentos e limita tamanho dos textos', () => {
    expect(brCodeText('Pousada São João — Café & Cia', 25)).toBe('POUSADA SAO JOAO CAFE CIA')
  })
  it('recusa valor zero', () => {
    expect(() =>
      buildPixCopiaECola({
        keyType: 'email',
        key: 'a@b.co',
        merchantName: 'X',
        merchantCity: 'Y',
        amount: 0,
        txid: 'A',
      }),
    ).toThrow()
  })
})
