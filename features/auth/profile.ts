import { z } from 'zod'
import { cepSchema, isValidCpf, phoneSchema, ufSchema } from '@/lib/validation/br'

/**
 * Cadastro do viajante (0073) — regras puras, usadas no formulário (cliente),
 * na action (servidor) e na trava da reserva. Sem `.transform()` (ver
 * `lib/validation/br.ts`).
 */

export type Nationality = 'brasileira' | 'estrangeira'

/** Idade completa em anos numa data de referência (datas ISO `YYYY-MM-DD`). */
export function ageOn(birthIso: string, today: Date = new Date()): number {
  const [y, m, d] = birthIso.split('-').map(Number)
  if (!y || !m || !d) return -1
  let age = today.getFullYear() - y
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)
  if (beforeBirthday) age -= 1
  return age
}

const birthDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de nascimento.')
  .refine((v) => v >= '1900-01-01', 'Data de nascimento inválida.')
  .refine((v) => ageOn(v) >= 18, 'O responsável pela reserva precisa ter 18 anos ou mais.')

export const travelerProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, 'Informe seu nome completo.')
      .max(150, 'Nome muito longo.')
      .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, 'Informe nome e sobrenome.'),
    phone: phoneSchema,
    whatsapp: phoneSchema.or(z.literal('')),
    birthDate,
    nationality: z.enum(['brasileira', 'estrangeira']),
    /** Vazio = manter o documento já salvo. */
    documentNumber: z.string().trim().max(30),
    hasStoredDocument: z.boolean(),
    country: z.string().trim().max(60),
    cep: cepSchema.or(z.literal('')),
    address: z.string().trim().max(200),
    city: z.string().trim().min(2, 'Informe sua cidade.').max(100),
    state: ufSchema.or(z.literal('')),
    emergencyName: z.string().trim().max(120),
    emergencyPhone: phoneSchema.or(z.literal('')),
    dietaryRestrictions: z.string().trim().max(300),
    accessibilityNeeds: z.string().trim().max(300),
    /** Para onde voltar depois de salvar (ex.: a reserva em andamento). */
    next: z.string().max(500),
  })
  .superRefine((d, ctx) => {
    const brazilian = d.nationality === 'brasileira'
    if (brazilian && !d.state) {
      ctx.addIssue({ code: 'custom', path: ['state'], message: 'Informe a UF.' })
    }
    if (!brazilian && d.country.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['country'], message: 'Informe o país onde você mora.' })
    }
    if (d.documentNumber) {
      if (brazilian && !isValidCpf(d.documentNumber)) {
        ctx.addIssue({ code: 'custom', path: ['documentNumber'], message: 'CPF inválido.' })
      }
      if (!brazilian && !/^[A-Za-z0-9]{5,20}$/.test(d.documentNumber)) {
        ctx.addIssue({
          code: 'custom',
          path: ['documentNumber'],
          message: 'Passaporte inválido (só letras e números).',
        })
      }
    } else if (!d.hasStoredDocument) {
      ctx.addIssue({
        code: 'custom',
        path: ['documentNumber'],
        message: brazilian ? 'Informe seu CPF.' : 'Informe o número do passaporte.',
      })
    }
    if (d.emergencyPhone && !d.emergencyName) {
      ctx.addIssue({
        code: 'custom',
        path: ['emergencyName'],
        message: 'Informe o nome do contato de emergência.',
      })
    }
  })
export type TravelerProfileInput = z.infer<typeof travelerProfileSchema>

export function documentTypeFor(nationality: Nationality): 'CPF' | 'Passaporte' {
  return nationality === 'brasileira' ? 'CPF' : 'Passaporte'
}

/** O que a pousada precisa para a ficha (FNRH) — base da trava da reserva. */
export type ProfileCompleteness = {
  fullName: string
  phone: string | null
  birthDate: string | null
  documentType: string | null
  hasDocument: boolean
  nationality: Nationality
  city: string | null
  state: string | null
  country: string | null
}

export function missingProfileItems(p: ProfileCompleteness): string[] {
  const missing: string[] = []
  if (p.fullName.trim().split(/\s+/).filter(Boolean).length < 2) missing.push('nome completo')
  if (!p.phone) missing.push('celular')
  if (!p.birthDate) missing.push('data de nascimento')
  if (!p.hasDocument || p.documentType !== documentTypeFor(p.nationality)) {
    missing.push(p.nationality === 'brasileira' ? 'CPF' : 'passaporte')
  }
  if (!p.city) missing.push('cidade')
  if (p.nationality === 'brasileira' ? !p.state : !p.country || p.country === 'BR') {
    missing.push(p.nationality === 'brasileira' ? 'UF' : 'país')
  }
  return missing
}

/** "CPF ***.***.**9-09" / "Passaporte ****1234" — nunca o número inteiro na tela. */
export function maskedDocument(type: string | null, last4: string | null): string | null {
  if (!type || !last4) return null
  return type === 'CPF'
    ? `CPF •••.•••.•${last4.slice(0, 2)}-${last4.slice(2)}`
    : `${type} ••••${last4}`
}

/** Só caminhos internos (evita redirecionar para outro site). */
export function safeNextPath(next: string | null | undefined): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null
}

// Máscaras de digitação (só formatam; a validação é do schema).
const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max)

export function maskCpf(v: string): string {
  const d = digits(v, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function maskPhone(v: string): string {
  const d = digits(v, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function maskCep(v: string): string {
  const d = digits(v, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}
