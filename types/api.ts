/**
 * Transport / infrastructure types shared across services, server helpers and
 * actions. Kept separate from the domain model.
 */

/** Cursor/offset pagination envelope returned by list endpoints. */
export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Standard result shape for Server Actions (form submissions, mutations). */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export type SortDirection = 'asc' | 'desc'

/** Generic query for list endpoints — the seam a real backend will implement. */
export type ListQuery = {
  checkin?: string
  checkout?: string
  guests?: number
  search?: string
  page?: number
  pageSize?: number
  sort?: string
  direction?: SortDirection
}
