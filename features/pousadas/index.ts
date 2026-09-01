/**
 * Pousadas feature — public surface.
 *
 * A "feature" co-locates everything about one domain area: UI, server queries
 * and types. Components currently live under `components/` for backward
 * compatibility; this barrel is the import surface new code should use, so files
 * can be physically moved here later without breaking consumers.
 */
export { PousadaDetail } from '@/components/pousada/pousada-detail'
export { FeaturedPousadas } from '@/components/landing/featured-pousadas'
export {
  getPousada,
  getPousadas,
  getPousadaSlugs,
  getNearbyPousadas,
} from '@/server/queries'
export type { Pousada, Room, Review } from '@/types'
