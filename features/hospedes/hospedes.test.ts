import { describe, it, expect } from 'vitest'
import { guestFormSchema } from './schemas'

const base = {
  fullName: 'João da Silva',
  preferredName: '',
  email: '',
  phone: '',
  whatsapp: '',
  documentType: '',
  documentNumber: '',
  birthDate: '',
  nationality: '',
  country: 'BR',
  city: '',
  state: '',
  address: '',
  cep: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  preferences: [],
  dietaryRestrictions: '',
  accessibilityNeeds: '',
  internalNotes: '',
  marketingConsent: false,
}

describe('[Ciclo 4] guestFormSchema', () => {
  it('aceita hóspede sem nenhum dado de contato (hóspede sem conta pode ter cadastro mínimo)', () => {
    expect(guestFormSchema.safeParse(base).success).toBe(true)
  })
  it('rejeita nome muito curto', () => {
    expect(guestFormSchema.safeParse({ ...base, fullName: 'A' }).success).toBe(false)
  })
  it('aceita nascimento vazio ou no formato do campo de data (AAAA-MM-DD)', () => {
    expect(guestFormSchema.safeParse({ ...base, birthDate: '' }).success).toBe(true)
    expect(guestFormSchema.safeParse({ ...base, birthDate: '1980-05-20' }).success).toBe(true)
  })
  it('rejeita nascimento fora do formato de data', () => {
    expect(guestFormSchema.safeParse({ ...base, birthDate: '20/05/1980' }).success).toBe(false)
  })
  it('aceita cadastro completo', () => {
    const full = {
      ...base,
      preferredName: 'João',
      email: 'joao@example.com',
      phone: '11999998888',
      preferences: ['vegetariano', 'andar alto'],
      marketingConsent: true,
    }
    expect(guestFormSchema.safeParse(full).success).toBe(true)
  })
})
