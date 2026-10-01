import { describe, expect, it } from 'vitest'
import { isValidCpf } from '@/lib/validation/br'
import {
  ageOn,
  maskCep,
  maskCpf,
  maskPhone,
  maskedDocument,
  missingProfileItems,
  safeNextPath,
  travelerProfileSchema,
} from './profile'

const base = {
  fullName: 'Ana Souza',
  phone: '(11) 91234-5678',
  whatsapp: '',
  birthDate: '1990-05-10',
  nationality: 'brasileira' as const,
  documentNumber: '529.982.247-25',
  hasStoredDocument: false,
  country: '',
  cep: '',
  street: '',
  addressNumber: '',
  complement: '',
  district: '',
  city: 'Uberlândia',
  state: 'MG',
  emergencyName: '',
  emergencyPhone: '',
  dietaryRestrictions: '',
  accessibilityNeeds: '',
  next: '',
}

describe('CPF', () => {
  it('valida dígitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
  })
})

describe('cadastro do viajante', () => {
  it('aceita cadastro brasileiro completo', () => {
    expect(travelerProfileSchema.safeParse(base).success).toBe(true)
  })
  it('exige nome e sobrenome, CPF válido, UF e maioridade', () => {
    const r = travelerProfileSchema.safeParse({
      ...base,
      fullName: 'Ana',
      documentNumber: '111.111.111-11',
      state: '',
      birthDate: `${new Date().getFullYear() - 10}-01-01`,
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0])
      expect(paths).toEqual(
        expect.arrayContaining(['fullName', 'documentNumber', 'state', 'birthDate']),
      )
    }
  })
  it('documento em branco só vale se já houver um salvo', () => {
    expect(travelerProfileSchema.safeParse({ ...base, documentNumber: '' }).success).toBe(false)
    expect(
      travelerProfileSchema.safeParse({ ...base, documentNumber: '', hasStoredDocument: true })
        .success,
    ).toBe(true)
  })
  it('estrangeiro usa passaporte e país, sem UF', () => {
    const r = travelerProfileSchema.safeParse({
      ...base,
      nationality: 'estrangeira',
      documentNumber: 'AB123456',
      state: '',
      country: 'Argentina',
      city: 'Córdoba',
    })
    expect(r.success).toBe(true)
  })
  it('lista o que falta para reservar', () => {
    expect(
      missingProfileItems({
        fullName: 'Ana',
        phone: null,
        birthDate: null,
        documentType: null,
        hasDocument: false,
        nationality: 'brasileira',
        city: null,
        state: null,
        country: 'BR',
      }),
    ).toEqual(['nome completo', 'celular', 'data de nascimento', 'CPF', 'cidade', 'UF'])
    expect(
      missingProfileItems({
        fullName: 'Ana Souza',
        phone: '11912345678',
        birthDate: '1990-05-10',
        documentType: 'CPF',
        hasDocument: true,
        nationality: 'brasileira',
        city: 'Uberlândia',
        state: 'MG',
        country: 'BR',
      }),
    ).toEqual([])
  })
})

describe('utilitários', () => {
  it('idade e máscaras', () => {
    expect(ageOn('2000-09-28', new Date('2026-09-27T12:00:00'))).toBe(25)
    expect(ageOn('2000-09-27', new Date('2026-09-27T12:00:00'))).toBe(26)
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
    expect(maskPhone('11912345678')).toBe('(11) 91234-5678')
    expect(maskPhone('1134567890')).toBe('(11) 3456-7890')
    expect(maskCep('38400000')).toBe('38400-000')
    expect(maskedDocument('CPF', '4725')).toBe('CPF •••.•••.•47-25')
    expect(safeNextPath('//evil.com')).toBeNull()
    expect(safeNextPath('/\\evil.com')).toBeNull()
    expect(safeNextPath('/%0d%0a')).toBe('/%0d%0a')
    expect(safeNextPath('/a\nb')).toBeNull()
    expect(safeNextPath('https://evil.com')).toBeNull()
    expect(safeNextPath('/pousada/x/reservar?checkin=2026-10-01')).toBe(
      '/pousada/x/reservar?checkin=2026-10-01',
    )
  })
})

describe('validação reforçada (telefone, nome, endereço)', () => {
  it('telefone: DDD real, celular com 9 na frente, sem número repetido', async () => {
    const { isValidBrPhone, isValidIntlPhone } = await import('@/lib/validation/br')
    expect(isValidBrPhone('(34) 91234-5678', { mobileOnly: true })).toBe(true)
    expect(isValidBrPhone('+55 34 91234-5678', { mobileOnly: true })).toBe(true)
    expect(isValidBrPhone('(20) 91234-5678', { mobileOnly: true })).toBe(false)
    expect(isValidBrPhone('(34) 81234-5678', { mobileOnly: true })).toBe(false)
    expect(isValidBrPhone('(34) 99999-9999', { mobileOnly: true })).toBe(false)
    expect(isValidBrPhone('(34) 3234-5678', { mobileOnly: true })).toBe(false)
    expect(isValidBrPhone('(34) 3234-5678')).toBe(true)
    expect(isValidIntlPhone('+54 11 1234-5678')).toBe(true)
    expect(isValidIntlPhone('11 1234-5678')).toBe(false)
  })
  it('recusa celular inválido e nome com número', () => {
    const r = travelerProfileSchema.safeParse({
      ...base,
      phone: '(34) 3234-5678',
      fullName: 'Ana Souza 2',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path[0])).toEqual(
        expect.arrayContaining(['phone', 'fullName']),
      )
    }
  })
  it('estrangeiro pode usar celular internacional', () => {
    const r = travelerProfileSchema.safeParse({
      ...base,
      nationality: 'estrangeira',
      documentNumber: 'AB123456',
      state: '',
      country: 'Argentina',
      phone: '+54 9 11 1234-5678',
    })
    expect(r.success).toBe(true)
  })
  it('com rua, exige número; monta o endereço em uma linha', async () => {
    const r = travelerProfileSchema.safeParse({
      ...base,
      cep: '38400-000',
      street: 'Rua A',
      addressNumber: '',
    })
    expect(r.success).toBe(false)
    const { composeAddress } = await import('./profile')
    expect(
      composeAddress({
        street: 'Rua A',
        addressNumber: '123',
        complement: 'Apto 4',
        district: 'Centro',
      }),
    ).toBe('Rua A, 123 - Apto 4 - Centro')
    expect(maskPhone('+54 9 11 1234')).toBe('+54 9 11 1234')
  })
})
