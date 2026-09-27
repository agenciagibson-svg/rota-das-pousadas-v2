import type { GuestOrder } from '@/features/pedidos/types'
import type { GuestStay, StayMenuItem } from '../types'

export type StayTab = 'inicio' | 'estadia' | 'pedir' | 'conta' | 'recepcao'

/** O que as telas do app recebem da casca (estado e ações). */
export type StayCtx = {
  stay: GuestStay
  orders: GuestOrder[]
  /** Itens vendáveis (sem os serviços, que ficam em "Pedidos rápidos"). */
  products: StayMenuItem[]
  services: StayMenuItem[]
  cart: Record<string, number>
  cartCount: number
  /** Motivo para não aceitar pedidos agora (ou null). */
  orderBlockedReason: string | null
  /** Hora atual no fuso da pousada ("" até montar no navegador). */
  now: string
  wa: string | null
  mapsUrl: string
  wazeUrl: string
  go: (tab: StayTab, anchor?: string) => void
  openItem: (item: StayMenuItem) => void
  change: (item: StayMenuItem, delta: number) => void
  notify: (msg: string) => void
  copy: (text: string, msg: string) => void
  sendNow: (lines: [string, number][], note: string) => Promise<boolean>
  sending: boolean
  orderError: string | null
}
