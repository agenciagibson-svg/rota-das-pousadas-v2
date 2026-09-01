import 'server-only'
import { requireCapability } from './access'
import { queryAvailability } from '@/repositories/availability.repository'
import type { AvailabilityResult } from '@/features/acomodacoes/types'
import type { AvailabilityQueryInput } from '@/features/acomodacoes/schemas'

export async function checkAvailability(input: AvailabilityQueryInput): Promise<AvailabilityResult[]> {
  const { pousadaId } = await requireCapability('availability:check')
  return queryAvailability({
    pousadaId,
    checkin: input.checkin,
    checkout: input.checkout,
    adults: input.adults,
    children: input.children,
    pets: input.pets,
    categoryId: input.categoryId || undefined,
  })
}
