/**
 * Destinos e Experiências — camada de aplicação.
 * Delega acesso a dados ao Repository.
 */
import 'server-only'
import { getDestinationRepository } from '@/repositories/destinations.repository'
import type { Destination, Experience } from '@/types'

export async function listDestinations(): Promise<Destination[]> {
  return getDestinationRepository().list()
}

export async function getDestinationBySlug(slug: string): Promise<Destination | null> {
  return getDestinationRepository().findBySlug(slug)
}

export async function listExperiences(): Promise<Experience[]> {
  return getDestinationRepository().listExperiences()
}
