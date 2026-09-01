import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can, type Action } from '@/lib/auth/rbac'
import { listGuestsByPousada, getGuestById, upsertGuestRpc } from '@/repositories/guests.repository'
import type { GuestFilters } from '@/features/hospedes/schemas'
import type { GuestDetail, GuestListItem } from '@/features/hospedes/types'

async function requireCapability(action: Action) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Não autenticado.')
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) throw new Error('Nenhuma pousada ativa selecionada.')
  const role = await getActiveTenantRole()
  if (!role || !can(role, action)) throw new Error('Você não tem permissão para esta ação.')
  return { user, pousadaId, role }
}

export async function listGuests(filters: GuestFilters = {}): Promise<GuestListItem[]> {
  const { pousadaId } = await requireCapability('guest:manage')
  return listGuestsByPousada(pousadaId, filters)
}

export async function getGuestProfile(guestId: string): Promise<GuestDetail | null> {
  const { pousadaId } = await requireCapability('guest:manage')
  return getGuestById(pousadaId, guestId)
}

export type SaveGuestInput = {
  guestId?: string
  fullName: string
  preferredName?: string
  email?: string
  phone?: string
  whatsapp?: string
  documentType?: string
  documentNumber?: string
  birthDate?: string
  nationality?: string
  country?: string
  city?: string
  state?: string
  address?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  preferences: string[]
  dietaryRestrictions: string
  accessibilityNeeds: string
  internalNotes: string
  marketingConsent: boolean
}

export async function saveGuest(input: SaveGuestInput): Promise<{ id: string }> {
  const { pousadaId } = await requireCapability('guest:manage')
  return upsertGuestRpc({
    pousadaId,
    guestId: input.guestId,
    fullName: input.fullName,
    preferredName: input.preferredName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    documentType: input.documentType ?? null,
    documentNumber: input.documentNumber ?? null,
    birthDate: input.birthDate ?? null,
    nationality: input.nationality ?? null,
    country: input.country ?? 'BR',
    city: input.city ?? null,
    state: input.state ?? null,
    address: input.address ?? null,
    emergencyContact: {
      name: input.emergencyContactName || undefined,
      phone: input.emergencyContactPhone || undefined,
    },
    preferences: input.preferences,
    dietaryRestrictions: input.dietaryRestrictions,
    accessibilityNeeds: input.accessibilityNeeds,
    internalNotes: input.internalNotes,
    marketingConsent: input.marketingConsent,
    source: 'front_desk',
  })
}
