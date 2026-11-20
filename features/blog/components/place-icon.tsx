import { Church, Droplets, Mountain, MapPin, Trees, type LucideIcon } from 'lucide-react'
import type { BlogPlaceKind } from '../types'

const ICONS: Record<BlogPlaceKind, LucideIcon> = {
  cidade: MapPin,
  cachoeira: Droplets,
  mirante: Mountain,
  igreja: Church,
  parque: Trees,
}

export const PLACE_KIND_LABEL: Record<BlogPlaceKind, string> = {
  cidade: 'Cidade',
  cachoeira: 'Cachoeira',
  mirante: 'Mirante',
  igreja: 'Igreja',
  parque: 'Parque',
}

export function PlaceIcon({ kind, className }: { kind: BlogPlaceKind; className?: string }) {
  const Icon = ICONS[kind]
  return <Icon className={className} aria-hidden />
}
