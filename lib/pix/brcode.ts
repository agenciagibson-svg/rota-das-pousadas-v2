/**
 * Pix "copia e cola" estático (BR Code / padrão EMV do Banco Central) com
 * valor fixo. É o mesmo texto que vira o QR Code: qualquer app de banco lê,
 * já com a chave da pousada, o valor e a identificação da reserva. Não passa
 * por nenhum intermediário — o dinheiro cai direto na conta da chave.
 *
 * Referência: Manual de Padrões para Iniciação do Pix (BCB), BR Code estático.
 */

function field(id: string, value: string): string {
  const len = value.length
  if (len > 99) throw new Error(`Campo ${id} do Pix longo demais.`)
  return `${id}${String(len).padStart(2, '0')}${value}`
}

/** CRC16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF), exigido pelo BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Nome/cidade no BR Code: sem acento, só caracteres básicos, tamanho limitado. */
export function brCodeText(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim()
}

/** Chave no formato que o Pix espera (telefone com +55, CPF/CNPJ só números). */
export function normalizePixKey(type: PixKeyType, key: string): string {
  const k = key.trim()
  switch (type) {
    case 'cpf':
    case 'cnpj':
      return k.replace(/\D/g, '')
    case 'telefone': {
      const d = k.replace(/\D/g, '')
      return d.startsWith('55') && d.length >= 12 ? `+${d}` : `+55${d}`
    }
    case 'email':
      return k.toLowerCase()
    case 'aleatoria':
      return k.toLowerCase()
  }
}

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

export function buildPixCopiaECola(p: {
  keyType: PixKeyType
  key: string
  merchantName: string
  merchantCity: string
  amount: number
  /** Identificação que aparece no extrato da pousada (ex.: código da reserva). */
  txid: string
  description?: string
}): string {
  if (!(p.amount > 0)) throw new Error('Valor do Pix inválido.')
  const key = normalizePixKey(p.keyType, p.key)
  const txid = p.txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const description = p.description ? brCodeText(p.description, 40) : ''
  const account =
    field('00', 'br.gov.bcb.pix') + field('01', key) + (description ? field('02', description) : '')

  const payload =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    field('54', p.amount.toFixed(2)) +
    field('58', 'BR') +
    field('59', brCodeText(p.merchantName, 25) || 'RECEBEDOR') +
    field('60', brCodeText(p.merchantCity, 15) || 'BRASIL') +
    field('62', field('05', txid)) +
    '6304'
  return payload + crc16(payload)
}
