import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  documentNumberLast4,
  encryptDocumentNumber,
  hashDocumentNumberForLookup,
} from '@/lib/crypto/document-cipher'

/**
 * Cadastro do viajante (0073). Sempre com a sessão do próprio usuário — a RLS
 * só deixa cada um ler/gravar a própria linha. O documento é cifrado aqui, na
 * borda, antes de sair do app (mesmo padrão de guests, 0058); a tela só
 * recebe tipo + 4 últimos dígitos, nunca o número.
 */

export type TravelerProfileRow = {
  phone: string | null
  whatsapp: string | null
  birthDate: string | null
  nationality: string | null
  country: string
  documentType: string | null
  documentLast4: string | null
  hasDocument: boolean
  cep: string | null
  address: string | null
  street: string | null
  addressNumber: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  emergencyContact: { name?: string; phone?: string }
  dietaryRestrictions: string
  accessibilityNeeds: string
}

export async function getTravelerProfile(userId: string): Promise<TravelerProfileRow | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('traveler_profiles')
    .select(
      'phone, whatsapp, birth_date, nationality, country, document_type, document_last4, document_number_hash, cep, address, street, address_number, complement, district, city, state, emergency_contact, dietary_restrictions, accessibility_needs',
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const emergency = (data.emergency_contact ?? {}) as { name?: unknown; phone?: unknown }
  return {
    phone: data.phone,
    whatsapp: data.whatsapp,
    birthDate: data.birth_date,
    nationality: data.nationality,
    country: data.country,
    documentType: data.document_type,
    documentLast4: data.document_last4,
    hasDocument: Boolean(data.document_number_hash),
    cep: data.cep,
    address: data.address,
    street: data.street,
    addressNumber: data.address_number,
    complement: data.complement,
    district: data.district,
    city: data.city,
    state: data.state,
    emergencyContact: {
      ...(typeof emergency.name === 'string' ? { name: emergency.name } : {}),
      ...(typeof emergency.phone === 'string' ? { phone: emergency.phone } : {}),
    },
    dietaryRestrictions: data.dietary_restrictions,
    accessibilityNeeds: data.accessibility_needs,
  }
}

export type SaveTravelerProfileInput = {
  phone: string
  whatsapp: string | null
  birthDate: string
  nationality: string
  country: string
  /** `null` = manter o documento salvo. */
  document: { type: 'CPF' | 'Passaporte'; number: string } | null
  cep: string | null
  address: string | null
  street: string | null
  addressNumber: string | null
  complement: string | null
  district: string | null
  city: string
  state: string | null
  emergencyContact: { name?: string; phone?: string }
  dietaryRestrictions: string
  accessibilityNeeds: string
}

export async function saveTravelerProfile(
  userId: string,
  input: SaveTravelerProfileInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const documentFields = input.document
    ? {
        document_type: input.document.type,
        document_number: encryptDocumentNumber(input.document.number),
        document_number_hash: hashDocumentNumberForLookup(input.document.number),
        document_last4: documentNumberLast4(input.document.number),
      }
    : {}
  const { error } = await supabase.from('traveler_profiles').upsert(
    {
      user_id: userId,
      phone: input.phone,
      whatsapp: input.whatsapp,
      birth_date: input.birthDate,
      nationality: input.nationality,
      country: input.country,
      cep: input.cep,
      address: input.address,
      street: input.street,
      address_number: input.addressNumber,
      complement: input.complement,
      district: input.district,
      city: input.city,
      state: input.state,
      emergency_contact: input.emergencyContact,
      dietary_restrictions: input.dietaryRestrictions,
      accessibility_needs: input.accessibilityNeeds,
      updated_at: new Date().toISOString(),
      ...documentFields,
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    // uq_traveler_profiles_document_hash (0074): documento já usado em outra conta.
    if (error.code === '23505') {
      throw new Error(
        'Este documento já está cadastrado em outra conta. Se for seu, entre com a outra conta ou fale com o suporte.',
      )
    }
    throw new Error('Não foi possível salvar seu cadastro. Tente de novo.')
  }
}
