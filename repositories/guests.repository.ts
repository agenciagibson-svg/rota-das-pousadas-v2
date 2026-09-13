import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { EmergencyContact, GuestBookingSummary, GuestDetail, GuestListItem, GuestSource } from '@/features/hospedes/types'
import type { GuestFilters } from '@/features/hospedes/schemas'

/** Nunca expõe o documento completo fora do perfil individual (RB seção 3). */
function maskDocument(documentNumber: string | null): string | null {
  if (!documentNumber) return null
  const digits = documentNumber.trim()
  if (digits.length <= 4) return '••••'
  return `•••• ${digits.slice(-4)}`
}

type GuestRow = {
  id: string
  full_name: string
  preferred_name: string | null
  email: string | null
  phone: string | null
  document_number: string | null
  city: string | null
  created_at: string
}

export async function listGuestsByPousada(pousadaId: string, filters: GuestFilters = {}): Promise<GuestListItem[]> {
  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('guests')
    .select('id, full_name, preferred_name, email, phone, document_number, city, created_at')
    .eq('pousada_id', pousadaId)
    .order('created_at', { ascending: false })

  if (filters.name) query = query.ilike('full_name', `%${filters.name}%`)
  if (filters.email) query = query.ilike('email', `%${filters.email}%`)
  if (filters.phone) query = query.ilike('phone', `%${filters.phone}%`)
  if (filters.document) query = query.ilike('document_number', `%${filters.document}%`)

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as GuestRow[]
  if (rows.length === 0) return []

  const guestIds = rows.map((r) => r.id)
  const { data: bookingRows } = await supabase
    .from('bookings')
    .select('responsible_guest_id, checkin')
    .in('responsible_guest_id', guestIds)

  const countByGuest = new Map<string, number>()
  const lastByGuest = new Map<string, string>()
  for (const b of bookingRows ?? []) {
    const id = b.responsible_guest_id as string
    countByGuest.set(id, (countByGuest.get(id) ?? 0) + 1)
    const prev = lastByGuest.get(id)
    if (!prev || b.checkin > prev) lastByGuest.set(id, b.checkin)
  }

  let items: GuestListItem[] = rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    preferredName: r.preferred_name,
    email: r.email,
    phone: r.phone,
    city: r.city,
    documentMasked: maskDocument(r.document_number),
    bookingsCount: countByGuest.get(r.id) ?? 0,
    lastBookingAt: lastByGuest.get(r.id) ?? null,
    isIncomplete: !r.email && !r.phone,
    createdAt: r.created_at,
  }))

  if (filters.recurrentOnly) items = items.filter((g) => g.bookingsCount > 1)
  if (filters.incompleteOnly) items = items.filter((g) => g.isIncomplete)

  return items
}

export async function getGuestById(pousadaId: string, guestId: string): Promise<GuestDetail | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('guests')
    .select(
      'id, pousada_id, user_id, full_name, preferred_name, email, phone, whatsapp, document_type, document_number, birth_date, nationality, country, city, state, address, cep, emergency_contact, preferences, dietary_restrictions, accessibility_needs, internal_notes, marketing_consent, source, created_at, updated_at',
    )
    .eq('id', guestId)
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const { data: bookingRows } = await supabase
    .from('bookings')
    .select('id, code, room_id, checkin, checkout, status, total')
    .eq('responsible_guest_id', guestId)
    .order('checkin', { ascending: false })

  const roomIds = [...new Set((bookingRows ?? []).map((b) => b.room_id))]
  const { data: rooms } = roomIds.length
    ? await supabase.from('rooms').select('id, name').in('id', roomIds)
    : { data: [] }
  const roomById = new Map((rooms ?? []).map((r) => [r.id, r.name]))

  const bookings: GuestBookingSummary[] = (bookingRows ?? []).map((b) => ({
    id: b.id,
    code: b.code,
    roomName: roomById.get(b.room_id) ?? 'Acomodação',
    checkin: b.checkin,
    checkout: b.checkout,
    status: b.status,
    total: Number(b.total),
  }))

  return {
    id: data.id,
    pousadaId: data.pousada_id,
    userId: data.user_id,
    fullName: data.full_name,
    preferredName: data.preferred_name,
    email: data.email,
    phone: data.phone,
    whatsapp: data.whatsapp,
    documentType: data.document_type,
    documentNumber: data.document_number,
    birthDate: data.birth_date,
    nationality: data.nationality,
    country: data.country,
    city: data.city,
    state: data.state,
    address: data.address,
    cep: data.cep,
    emergencyContact: (data.emergency_contact ?? {}) as EmergencyContact,
    preferences: (data.preferences ?? []) as string[],
    dietaryRestrictions: data.dietary_restrictions,
    accessibilityNeeds: data.accessibility_needs,
    internalNotes: data.internal_notes,
    marketingConsent: data.marketing_consent,
    source: data.source as GuestSource,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    bookings,
  }
}

export type UpsertGuestInput = {
  pousadaId: string
  guestId?: string
  userId?: string | null
  fullName: string
  preferredName?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  documentType?: string | null
  documentNumber?: string | null
  birthDate?: string | null
  nationality?: string | null
  country?: string
  city?: string | null
  state?: string | null
  address?: string | null
  cep?: string | null
  emergencyContact?: EmergencyContact
  preferences?: string[]
  dietaryRestrictions?: string
  accessibilityNeeds?: string
  internalNotes?: string
  marketingConsent?: boolean
  source?: GuestSource
}

/** Cria ou atualiza um hóspede via RPC (regras de acesso e deduplicação vivem no banco). */
export async function upsertGuestRpc(input: UpsertGuestInput): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('upsert_guest', {
    p_pousada_id: input.pousadaId,
    p_guest_id: input.guestId ?? null,
    p_user_id: input.userId ?? null,
    p_full_name: input.fullName,
    p_preferred_name: input.preferredName ?? null,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_whatsapp: input.whatsapp ?? null,
    p_document_type: input.documentType ?? null,
    p_document_number: input.documentNumber ?? null,
    p_birth_date: input.birthDate ?? null,
    p_nationality: input.nationality ?? null,
    p_country: input.country ?? 'BR',
    p_city: input.city ?? null,
    p_state: input.state ?? null,
    p_address: input.address ?? null,
    p_cep: input.cep ?? null,
    p_emergency_contact: input.emergencyContact ?? {},
    p_preferences: input.preferences ?? [],
    p_dietary_restrictions: input.dietaryRestrictions ?? '',
    p_accessibility_needs: input.accessibilityNeeds ?? '',
    p_internal_notes: input.internalNotes ?? '',
    p_marketing_consent: input.marketingConsent ?? false,
    p_source: input.source ?? 'front_desk',
  })
  if (error) throw new Error(error.message)
  const result = data as { id: string }
  return { id: result.id }
}
