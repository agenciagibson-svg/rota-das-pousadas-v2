import { z } from 'zod'
import { ufSchema, phoneSchema, cepSchema } from '@/lib/validation/br'

/** Cadastro/edição de hóspede — usado pela recepção/proprietário/admin. Campos opcionais aceitam string vazia (tratada como "ausente" no service). */
export const guestFormSchema = z.object({
  guestId: z.string().uuid().optional(),
  fullName: z.string().trim().min(2, 'Informe o nome completo.').max(200),
  preferredName: z.string().trim().max(100),
  email: z.string().trim().email('E-mail inválido.').max(200).or(z.literal('')),
  phone: phoneSchema.or(z.literal('')),
  whatsapp: phoneSchema.or(z.literal('')),
  documentType: z.string().trim().max(30),
  documentNumber: z.string().trim().max(50),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida.')
    .or(z.literal('')),
  nationality: z.string().trim().max(60),
  country: z.string().trim().max(2),
  city: z.string().trim().max(100),
  state: ufSchema.or(z.literal('')),
  address: z.string().trim().max(300),
  cep: cepSchema.or(z.literal('')),
  emergencyContactName: z.string().trim().max(150),
  emergencyContactPhone: phoneSchema.or(z.literal('')),
  preferences: z.array(z.string().trim().max(60)).max(20),
  dietaryRestrictions: z.string().trim().max(500),
  accessibilityNeeds: z.string().trim().max(500),
  internalNotes: z.string().trim().max(2000),
  marketingConsent: z.boolean(),
})
export type GuestFormInput = z.infer<typeof guestFormSchema>

export const guestIdSchema = z.object({ guestId: z.string().uuid('Hóspede inválido.') })
export type GuestIdInput = z.infer<typeof guestIdSchema>

export const guestFiltersSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  document: z.string().trim().optional(),
  recurrentOnly: z.boolean().optional(),
  incompleteOnly: z.boolean().optional(),
})
export type GuestFilters = z.infer<typeof guestFiltersSchema>
