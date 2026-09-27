import 'server-only'
import { getCurrentUser, updateMyName } from './auth.service'
import {
  getTravelerProfile,
  saveTravelerProfile,
  type TravelerProfileRow,
} from '@/repositories/traveler-profiles.repository'
import {
  documentTypeFor,
  missingProfileItems,
  type Nationality,
  type TravelerProfileInput,
} from '../profile'

export type MyProfile = {
  fullName: string
  email: string
  nationality: Nationality
  profile: TravelerProfileRow | null
  missing: string[]
}

function nationalityOf(profile: TravelerProfileRow | null): Nationality {
  return profile && profile.country !== 'BR' ? 'estrangeira' : 'brasileira'
}

/** Cadastro do usuário logado + o que falta para poder reservar. `null` = sem login. */
export async function getMyProfile(): Promise<MyProfile | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const profile = await getTravelerProfile(user.id)
  const nationality = nationalityOf(profile)
  return {
    fullName: user.name,
    email: user.email,
    nationality,
    profile,
    missing: missingProfileItems({
      fullName: user.name,
      phone: profile?.phone ?? null,
      birthDate: profile?.birthDate ?? null,
      documentType: profile?.documentType ?? null,
      hasDocument: profile?.hasDocument ?? false,
      nationality,
      city: profile?.city ?? null,
      state: profile?.state ?? null,
      country: profile?.country ?? null,
    }),
  }
}

export async function saveMyProfile(input: TravelerProfileInput): Promise<{ missing: string[] }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para continuar.')
  const current = await getTravelerProfile(user.id)
  const docType = documentTypeFor(input.nationality)
  const newDocument = input.documentNumber.trim()

  // Trocou de brasileiro para estrangeiro (ou o contrário): o documento salvo
  // é de outro tipo e não serve mais — precisa informar o novo.
  if (!newDocument && (!current?.hasDocument || current.documentType !== docType)) {
    throw new Error(
      input.nationality === 'brasileira' ? 'Informe seu CPF.' : 'Informe o número do passaporte.',
    )
  }

  if (input.fullName.trim() !== user.name.trim()) await updateMyName(input.fullName)

  const brazilian = input.nationality === 'brasileira'
  await saveTravelerProfile(user.id, {
    phone: input.phone,
    whatsapp: input.whatsapp || null,
    birthDate: input.birthDate,
    nationality: brazilian ? 'Brasileira' : 'Estrangeira',
    country: brazilian ? 'BR' : input.country,
    document: newDocument ? { type: docType, number: newDocument } : null,
    cep: input.cep || null,
    address: input.address || null,
    city: input.city,
    state: brazilian ? input.state.toUpperCase() : null,
    emergencyContact: {
      ...(input.emergencyName ? { name: input.emergencyName } : {}),
      ...(input.emergencyPhone ? { phone: input.emergencyPhone } : {}),
    },
    dietaryRestrictions: input.dietaryRestrictions,
    accessibilityNeeds: input.accessibilityNeeds,
  })

  // Recalcula com o que acabou de ser salvo (getCurrentUser é memoizado por
  // request e ainda teria o nome antigo).
  return {
    missing: missingProfileItems({
      fullName: input.fullName,
      phone: input.phone,
      birthDate: input.birthDate,
      documentType: docType,
      hasDocument: true,
      nationality: input.nationality,
      city: input.city,
      state: brazilian ? input.state : null,
      country: brazilian ? 'BR' : input.country,
    }),
  }
}
