/**
 * Marketing feature — the public landing experience.
 */
export { Hero } from '@/components/landing/hero'
export { Destinations } from '@/components/landing/destinations'
export { Experiences } from '@/components/landing/experiences'
export { Editorial } from '@/components/landing/editorial'
export { getDestinations, getDestination, getExperiences } from '@/server/queries'
export type { Destination, Experience, Season } from '@/types'
