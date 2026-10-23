import { ClipboardCheck, ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { staffPrecheckinBadge } from '../precheckin'
import type { BookingStatus } from '../types'

/** "Ficha completa" / "Ficha pendente" (0088) — chegadas de hoje em diante, visão da equipe. */
export function PrecheckinBadge({
  status,
  checkin,
  precheckinDone,
  todayISO,
  size = 'sm',
}: {
  status: BookingStatus
  checkin: string
  precheckinDone: boolean
  todayISO: string
  size?: 'sm' | 'md'
}) {
  const state = staffPrecheckinBadge({ status, checkin, precheckinDone }, todayISO)
  if (!state) return null
  return state === 'done' ? (
    <Badge variant="primarySoft" size={size}>
      <ClipboardCheck className="size-3" />
      Ficha completa
    </Badge>
  ) : (
    <Badge variant="outline" size={size}>
      <ClipboardList className="size-3" />
      Ficha pendente
    </Badge>
  )
}
