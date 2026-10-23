import { z } from 'zod'
import { ageOn, isAcceptedPhone, type Nationality } from '@/features/auth/profile'
import { cepSchema, isValidCpf, ufSchema } from '@/lib/validation/br'
import type { BookingStatus } from './types'

/**
 * Pré-check-in online (0088) — regras puras, usadas no formulário (cliente),
 * na action (servidor) e nas telas que decidem se mostram o link. Sem
 * `.transform()` (ver `lib/validation/br.ts`). O banco (`submit_precheckin`)
 * repete as travas de tamanho, tipo, posse e status.
 */

/** Caminho do formulário do hóspede. */
export function precheckinPath(bookingId: string): string {
  return `/minhas-reservas/${bookingId}/pre-check-in`
}

export const COMPANION_TYPES = ['adult', 'child', 'infant'] as const
export type CompanionType = (typeof COMPANION_TYPES)[number]

export const COMPANION_TYPE_LABEL: Record<CompanionType, string> = {
  adult: 'Adulto',
  child: 'Criança',
  infant: 'Bebê',
}

/** Documentos aceitos para acompanhante (o banco aceita os mesmos). */
export const COMPANION_DOCUMENT_TYPES = [
  'CPF',
  'RG',
  'Passaporte',
  'Certidão de nascimento',
] as const

const isoDate = /^\d{4}-\d{2}-\d{2}$/
const arrivalTime = /^([01]\d|2[0-3]):[0-5]\d$/

/** Data de hoje em `YYYY-MM-DD` no fuso de Brasília (só para o limite do formulário). */
function todayBr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export const precheckinCompanionSchema = z
  .object({
    /** Linha já salva cujo documento continua valendo (documento em branco = manter). */
    keepDocumentOf: z.string().uuid().or(z.literal('')),
    /** Linha já salva deste acompanhante (com ou sem documento): o banco mantém as anotações da equipe. */
    previousId: z.string().uuid().or(z.literal('')).default(''),
    fullName: z
      .string()
      .trim()
      .min(2, 'Informe o nome.')
      .max(150, 'Nome muito longo.')
      .refine(
        (v) => !/[\d@_#$%*=+<>{}[\]\\|/]/.test(v),
        'O nome não pode ter números ou símbolos.',
      ),
    guestType: z.enum(COMPANION_TYPES),
    birthDate: z.string().trim().regex(isoDate, 'Data inválida.').or(z.literal('')),
    documentType: z.enum(COMPANION_DOCUMENT_TYPES).or(z.literal('')),
    documentNumber: z.string().trim().max(30, 'Documento muito longo.'),
  })
  .superRefine((c, ctx) => {
    if (c.birthDate && (c.birthDate < '1900-01-01' || c.birthDate > todayBr())) {
      ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'Data inválida.' })
    }
    if (c.guestType === 'adult' && !c.birthDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['birthDate'],
        message: 'Informe a data de nascimento.',
      })
    }
    if (c.documentNumber) {
      if (!c.documentType) {
        ctx.addIssue({ code: 'custom', path: ['documentType'], message: 'Escolha o documento.' })
      } else if (c.documentType === 'CPF' && !isValidCpf(c.documentNumber)) {
        ctx.addIssue({ code: 'custom', path: ['documentNumber'], message: 'CPF inválido.' })
      } else if (!/^[A-Za-z0-9.\-/ ]{3,30}$/.test(c.documentNumber)) {
        ctx.addIssue({ code: 'custom', path: ['documentNumber'], message: 'Documento inválido.' })
      }
    } else if (c.guestType === 'adult' && !c.keepDocumentOf) {
      ctx.addIssue({
        code: 'custom',
        path: ['documentNumber'],
        message: 'Informe o documento do adulto.',
      })
    }
  })
export type PrecheckinCompanionInput = z.infer<typeof precheckinCompanionSchema>

export const precheckinSchema = z
  .object({
    bookingId: z.string().uuid('Reserva inválida.'),
    phone: z.string().trim().min(1, 'Informe seu celular.').max(25),
    birthDate: z
      .string()
      .trim()
      .regex(isoDate, 'Informe a data de nascimento.')
      .refine((v) => v >= '1900-01-01', 'Data de nascimento inválida.')
      .refine((v) => ageOn(v) >= 18, 'O responsável pela reserva precisa ter 18 anos ou mais.'),
    nationality: z.enum(['brasileira', 'estrangeira']),
    /** Vazio = manter o documento já salvo na ficha. */
    documentNumber: z.string().trim().max(30),
    hasStoredDocument: z.boolean(),
    country: z.string().trim().max(60),
    cep: cepSchema.or(z.literal('')),
    address: z.string().trim().max(300, 'Endereço muito longo.'),
    city: z.string().trim().min(2, 'Informe sua cidade.').max(100),
    state: ufSchema.or(z.literal('')),
    companions: z.array(precheckinCompanionSchema).max(20, 'Acompanhantes demais.'),
    expectedArrivalTime: z
      .string()
      .trim()
      .regex(arrivalTime, 'Use o formato 14:30.')
      .or(z.literal('')),
  })
  .superRefine((d, ctx) => {
    const brazilian = d.nationality === 'brasileira'
    if (!isAcceptedPhone(d.phone, { mobileOnly: true, allowInternational: !brazilian })) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: brazilian
          ? 'Celular inválido. Use DDD + 9 dígitos, ex.: (34) 91234-5678.'
          : 'Celular inválido. Use DDD + número ou o formato internacional (+54 11 ...).',
      })
    }
    if (d.address.length < 5) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: 'Informe rua, número e bairro.',
      })
    }
    if (brazilian && !d.state) {
      ctx.addIssue({ code: 'custom', path: ['state'], message: 'Informe a UF.' })
    }
    if (!brazilian && (d.country.length < 2 || d.country.toUpperCase() === 'BR')) {
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
  })
export type PrecheckinInput = z.infer<typeof precheckinSchema>

/** Limite de acompanhantes que o banco aceita (`get_my_precheckin`). */
export type CompanionLimits = { maxCompanions: number; maxInfants: number }

/** Mensagem de excesso de acompanhantes, ou `null` se está dentro do limite. */
export function companionLimitError(
  companions: Pick<PrecheckinCompanionInput, 'guestType'>[],
  limits: CompanionLimits,
): string | null {
  const people = companions.filter((c) => c.guestType !== 'infant').length
  const infants = companions.length - people
  if (people > limits.maxCompanions) {
    return limits.maxCompanions === 0
      ? 'Sua reserva é só para você. Para levar mais alguém, fale com a pousada.'
      : `Sua reserva tem lugar para mais ${limits.maxCompanions} ${limits.maxCompanions === 1 ? 'pessoa' : 'pessoas'} além de você. Para levar mais alguém, fale com a pousada.`
  }
  if (infants > limits.maxInfants) {
    return 'Bebês demais para esta reserva. Fale com a pousada.'
  }
  return null
}

// ---------------------------------------------------------------------------
// Quando mostrar
// ---------------------------------------------------------------------------

type GuestBookingLike = {
  status: BookingStatus
  checkout: string
  paymentDueAt: string | null
  precheckinCompletedAt?: string | null
}

/**
 * Situação da ficha no card do hóspede (/minhas-reservas):
 *  - `todo`: mostrar "Preencher ficha";
 *  - `done`: mostrar "Ficha enviada" (e permitir revisar enquanto dá);
 *  - `null`: não mostrar nada (cancelada, encerrada, prazo de pagamento vencido).
 */
export function guestPrecheckinState(
  booking: GuestBookingLike,
  todayISO: string,
  now: Date = new Date(),
): 'todo' | 'done' | null {
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    return booking.precheckinCompletedAt && booking.status === 'checked_in' ? 'done' : null
  }
  if (booking.checkout < todayISO) return null
  const expired =
    booking.status === 'pending' &&
    Boolean(booking.paymentDueAt) &&
    new Date(booking.paymentDueAt as string).getTime() <= now.getTime()
  if (expired) return null
  return booking.precheckinCompletedAt ? 'done' : 'todo'
}

/**
 * E-mails de confirmação e lembrete (0088): botão "Preencher ficha de
 * hospedagem" só quando a ficha ainda não foi enviada e a reserva tem conta
 * de hóspede no site (reserva de balcão sem conta não abre o formulário).
 * Contexto sem as chaves (RPC anterior à 0088) não mostra o botão.
 */
export function emailOffersPrecheckin(ctx: {
  precheckinDone?: boolean
  hasTravelerAccount?: boolean
  status?: string
}): boolean {
  if (ctx.precheckinDone !== false || ctx.hasTravelerAccount !== true) return false
  return ctx.status === undefined || ctx.status === 'pending' || ctx.status === 'confirmed'
}

/**
 * Badge da equipe ("Ficha completa" / "Ficha pendente") — só para chegadas de
 * hoje em diante. Pendente só faz sentido antes do check-in; completa também
 * vale para quem já entrou hoje.
 */
export function staffPrecheckinBadge(
  reservation: { status: BookingStatus; checkin: string; precheckinDone: boolean },
  todayISO: string,
): 'done' | 'pending' | null {
  if (reservation.checkin < todayISO) return null
  if (reservation.status === 'pending' || reservation.status === 'confirmed') {
    return reservation.precheckinDone ? 'done' : 'pending'
  }
  if (reservation.status === 'checked_in' && reservation.precheckinDone) return 'done'
  return null
}

// ---------------------------------------------------------------------------
// Pré-preenchimento
// ---------------------------------------------------------------------------

/** Ficha atual da reserva, como `get_my_precheckin` devolve. */
export type PrecheckinSnapshot = {
  bookingId: string
  code: string
  status: BookingStatus
  checkin: string
  checkout: string
  adults: number
  children: number
  infants: number
  expectedArrivalTime: string | null
  precheckinCompletedAt: string | null
  pousadaName: string
  checkinTime: string
  canSubmit: boolean
  maxCompanions: number
  maxInfants: number
  responsible: {
    fullName: string
    phone: string | null
    birthDate: string | null
    nationality: string | null
    country: string | null
    city: string | null
    state: string | null
    address: string | null
    cep: string | null
    documentType: string | null
    documentLast4: string | null
    hasDocument: boolean
  }
  companions: {
    id: string
    fullName: string
    guestType: 'adult' | 'child' | 'infant'
    birthDate: string | null
    documentType: string | null
    hasDocument: boolean
  }[]
}

/** O que interessa do cadastro do viajante (0073) para pré-preencher. */
export type ProfilePrefill = {
  phone: string | null
  birthDate: string | null
  country: string | null
  city: string | null
  state: string | null
  address: string | null
  cep: string | null
}

/** Documento já salvo de cada acompanhante (id da linha → tipo), para o formulário dizer "mantido". */
export type StoredCompanionDocuments = Record<string, string>

function nationalityFrom(country: string | null, nationality: string | null): Nationality {
  if (nationality && /^estrangeir/i.test(nationality)) return 'estrangeira'
  if (nationality && /^brasileir/i.test(nationality)) return 'brasileira'
  return !country || country.toUpperCase() === 'BR' ? 'brasileira' : 'estrangeira'
}

/**
 * Valores iniciais do formulário. Se a ficha já foi enviada, ela manda (é o
 * que o hóspede escreveu para ESTA reserva); senão o cadastro do viajante vem
 * primeiro (é o mais recente) e a ficha da pousada completa o que faltar.
 */
export function buildPrecheckinDefaults(
  snapshot: PrecheckinSnapshot,
  profile: ProfilePrefill | null,
): PrecheckinInput {
  const ficha = snapshot.responsible
  const fichaFirst = Boolean(snapshot.precheckinCompletedAt)
  const pick = (a: string | null | undefined, b: string | null | undefined) => {
    const [first, second] = fichaFirst ? [a, b] : [b, a]
    return (first ?? '').trim() || (second ?? '').trim()
  }
  const country = pick(ficha.country, profile?.country)
  const nationality = nationalityFrom(country || null, fichaFirst ? ficha.nationality : null)
  const brazilian = nationality === 'brasileira'
  const expectedType = brazilian ? 'CPF' : 'Passaporte'
  const arrival = (snapshot.expectedArrivalTime ?? '').trim()

  return {
    bookingId: snapshot.bookingId,
    phone: pick(ficha.phone, profile?.phone),
    birthDate: pick(ficha.birthDate, profile?.birthDate),
    nationality,
    documentNumber: '',
    hasStoredDocument:
      ficha.hasDocument && (ficha.documentType ?? '').toUpperCase() === expectedType.toUpperCase(),
    country: brazilian ? 'BR' : country,
    cep: brazilian ? pick(ficha.cep, profile?.cep) : '',
    address: pick(ficha.address, profile?.address),
    city: pick(ficha.city, profile?.city),
    state: brazilian ? pick(ficha.state, profile?.state).toUpperCase() : '',
    expectedArrivalTime: arrivalTime.test(arrival) ? arrival : '',
    companions: snapshot.companions.map((c) => ({
      keepDocumentOf: c.hasDocument ? c.id : '',
      previousId: c.id,
      fullName: c.fullName,
      guestType: c.guestType,
      birthDate: c.birthDate ?? '',
      documentType: '',
      documentNumber: '',
    })),
  }
}

export function storedCompanionDocuments(snapshot: PrecheckinSnapshot): StoredCompanionDocuments {
  return Object.fromEntries(
    snapshot.companions
      .filter((c) => c.hasDocument)
      .map((c) => [c.id, c.documentType ?? 'Documento']),
  )
}

/** Nacionalidade como a ficha (e a FNRH) guarda. */
export function nationalityLabel(nationality: Nationality): 'Brasileira' | 'Estrangeira' {
  return nationality === 'brasileira' ? 'Brasileira' : 'Estrangeira'
}
