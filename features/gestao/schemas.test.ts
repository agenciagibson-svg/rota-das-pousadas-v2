import { describe, expect, it } from 'vitest'
import { pousadaSettingsSchema } from './schemas'

const base = {
  name: 'Pousada Teste',
  legalName: '',
  taxId: '',
  city: 'São Tomé das Letras',
  state: 'MG',
  country: 'Brasil',
  address: '',
  cep: '',
  image: '',
  description: 'Pousada tranquila com vista para a serra e café caseiro.',
  tags: '',
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
  language: 'pt-BR',
  checkinTime: '14:00',
  checkoutTime: '12:00',
  contactPhone: '',
  whatsapp: '',
  notificationEmail: '',
  houseRules: '',
  cancellationPolicy: '',
}

function imageResult(image: string) {
  return pousadaSettingsSchema.safeParse({ ...base, image })
}

describe('pousadaSettingsSchema — imagem principal', () => {
  it('aceita a imagem padrão gravada pelo cadastro do /anunciar', () => {
    expect(imageResult('/placeholder.svg').success).toBe(true)
  })

  it('aceita campo vazio, caminho do site e URL http(s)', () => {
    expect(imageResult('').success).toBe(true)
    expect(imageResult('/images/pousada-1.png').success).toBe(true)
    expect(imageResult('https://cdn.example.test/foto.jpg').success).toBe(true)
  })

  it('recusa endereço que não é imagem do site nem http(s), com mensagem do campo', () => {
    for (const image of ['javascript:alert(1)', '//outro-site.example/foto.jpg', 'foto.jpg']) {
      const result = imageResult(image)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(['image'])
    }
  })
})
