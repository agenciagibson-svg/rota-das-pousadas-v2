import 'server-only'
import QRCode from 'qrcode'
import { getActivePousadaId, getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can, type Action, type Role } from '@/lib/auth/rbac'
import { publicEnv } from '@/lib/env'
import { pousadaToday } from '@/features/dashboard/metrics'
import { listReservationsByPousada } from '@/repositories/management.repository'
import { listInventoryItems } from '@/repositories/inventory.repository'
import {
  getConsumptionRpc,
  getGuestSettings,
  getOrderPousadaId,
  listBookingOrders,
  listConsumptionPayments,
  listPousadaOrders,
  registerConsumptionPaymentRpc,
  saveGuestSettings,
  setOrderStatusRpc,
  staffCreateOrderRpc,
} from '@/repositories/orders.repository'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  ConsumptionPayment,
  ConsumptionSummary,
  GuestOrder,
  GuestSettings,
  OrderStatus,
} from '../types'

async function requireAny(actions: Action[]): Promise<{ pousadaId: string; role: Role }> {
  const pousadaId = await getActivePousadaId()
  if (!pousadaId) throw new Error('Nenhuma pousada ativa selecionada.')
  const role = await getActiveTenantRole()
  if (!role || !actions.some((a) => can(role, a))) {
    throw new Error('Seu perfil não tem acesso a esta ação.')
  }
  return { pousadaId, role }
}

/** Papéis (espelham as RPCs de 0078). */
export function orderPermissions(role: Role) {
  return {
    operate: can(role, 'order:manage'),
    // Lançar consumo e ver valores: quem mexe com dinheiro da reserva.
    charge:
      role === 'proprietario' ||
      role === 'admin_pousada' ||
      role === 'recepcionista' ||
      role === 'master',
    showPrices: can(role, 'payment:register') || can(role, 'finance:pousada:view'),
    registerPayment: can(role, 'payment:register'),
  }
}

export type SellableItem = {
  id: string
  name: string
  price: number
  trackStock: boolean
  quantity: number
  showInApp: boolean
}

export type InHouseBooking = {
  id: string
  code: string
  guestName: string
  roomName: string
  checkin: string
  checkout: string
}

async function stayQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#1f2420', light: '#ffffff' },
  })
}

export async function getOrdersScreen(timeZone: string) {
  const { pousadaId, role } = await requireAny(['order:manage'])
  const perms = orderPermissions(role)
  const today = pousadaToday(new Date(), timeZone).iso
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  const [orders, reservations, items] = await Promise.all([
    listPousadaOrders(pousadaId, since),
    perms.charge ? listReservationsByPousada(pousadaId, { checkinTo: today }) : Promise.resolve([]),
    perms.charge ? listInventoryItems(pousadaId) : Promise.resolve([]),
  ])

  const inHouse: InHouseBooking[] = reservations
    .filter(
      (r) =>
        (r.status === 'confirmed' || r.status === 'checked_in' || r.status === 'checked_out') &&
        r.checkin <= today &&
        r.checkout >= today,
    )
    .map((r) => ({
      id: r.id,
      code: r.code,
      guestName: r.guestName,
      roomName: r.roomName,
      checkin: r.checkin,
      checkout: r.checkout,
    }))

  const sellable: SellableItem[] = items
    .filter((i) => i.active && i.salePrice != null)
    .map((i) => ({
      id: i.id,
      name: i.name,
      price: i.salePrice ?? 0,
      trackStock: i.trackStock,
      quantity: i.quantity,
      showInApp: i.showInApp,
    }))

  const stayUrl = new URL('/estadia', publicEnv.siteUrl).toString()
  const hide = (o: GuestOrder): GuestOrder =>
    perms.showPrices
      ? o
      : { ...o, total: 0, lines: o.lines.map((l) => ({ ...l, unitPrice: 0, lineTotal: 0 })) }

  return {
    orders: orders.map(hide),
    inHouse,
    sellable,
    permissions: perms,
    stayUrl,
    stayQrSvg: await stayQrSvg(stayUrl),
    appItemsCount: items.filter((i) => i.active && i.showInApp).length,
  }
}

export async function changeOrderStatus(
  orderId: string,
  status: OrderStatus,
  reason: string | null,
) {
  const { pousadaId } = await requireAny(['order:manage'])
  if ((await getOrderPousadaId(orderId)) !== pousadaId) throw new Error('Pedido não encontrado.')
  await setOrderStatusRpc(orderId, status, reason)
}

async function requireBookingInPousada(bookingId: string, pousadaId: string) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('bookings')
    .select('pousada_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (data?.pousada_id !== pousadaId) throw new Error('Reserva não encontrada.')
}

export async function chargeConsumption(
  bookingId: string,
  items: { itemId: string; quantity: number }[],
  note: string,
) {
  const { pousadaId, role } = await requireAny(['order:manage'])
  if (!orderPermissions(role).charge) throw new Error('Seu perfil não pode lançar consumo.')
  await requireBookingInPousada(bookingId, pousadaId)
  return staffCreateOrderRpc(bookingId, items, note)
}

export type BookingConsumption = {
  orders: GuestOrder[]
  summary: ConsumptionSummary
  payments: ConsumptionPayment[]
  canRegisterPayment: boolean
  canCharge: boolean
  canOperate: boolean
}

/** Bloco "Conta de consumo" do detalhe da reserva. `null` se o papel não vê valores. */
export async function getBookingConsumption(bookingId: string): Promise<BookingConsumption | null> {
  const pousadaId = await getActivePousadaId()
  const role = await getActiveTenantRole()
  if (!pousadaId || !role) return null
  const perms = orderPermissions(role)
  if (!perms.showPrices) return null
  const [orders, summary, payments] = await Promise.all([
    listBookingOrders(bookingId),
    getConsumptionRpc(bookingId),
    listConsumptionPayments(bookingId),
  ])
  return {
    orders,
    summary,
    payments,
    canRegisterPayment: perms.registerPayment,
    canCharge: perms.charge,
    canOperate: perms.operate,
  }
}

export async function registerConsumptionPayment(
  bookingId: string,
  amount: number,
  method: ConsumptionPayment['method'],
  note: string,
) {
  const { pousadaId } = await requireAny(['payment:register'])
  await requireBookingInPousada(bookingId, pousadaId)
  await registerConsumptionPaymentRpc(bookingId, amount, method, note)
}

/** Itens que a equipe pode lançar numa reserva (detalhe da reserva). */
export async function listSellableItems(): Promise<SellableItem[]> {
  const { pousadaId, role } = await requireAny(['order:manage'])
  if (!orderPermissions(role).charge) return []
  const items = await listInventoryItems(pousadaId)
  return items
    .filter((i) => i.active && i.salePrice != null)
    .map((i) => ({
      id: i.id,
      name: i.name,
      price: i.salePrice ?? 0,
      trackStock: i.trackStock,
      quantity: i.quantity,
      showInApp: i.showInApp,
    }))
}

export async function getOwnerGuestSettings(): Promise<GuestSettings | null> {
  const pousadaId = await getActivePousadaId()
  const role = await getActiveTenantRole()
  if (!pousadaId || !role || !can(role, 'pousada:edit')) return null
  return getGuestSettings(pousadaId)
}

export async function saveOwnerGuestSettings(s: GuestSettings) {
  const { pousadaId } = await requireAny(['pousada:edit'])
  await saveGuestSettings(pousadaId, s)
}

/** Alertas para o Assistente: pedidos esperando e itens acabando. */
export async function getOperationalAlerts(): Promise<{
  newOrders: number
  lowStock: string[]
} | null> {
  const pousadaId = await getActivePousadaId()
  const role = await getActiveTenantRole()
  if (!pousadaId || !role) return null
  const [orders, items] = await Promise.all([
    can(role, 'order:manage')
      ? listPousadaOrders(pousadaId, new Date().toISOString())
      : Promise.resolve([]),
    can(role, 'inventory:view') ? listInventoryItems(pousadaId) : Promise.resolve([]),
  ])
  return {
    newOrders: orders.filter((o) => o.status === 'novo').length,
    lowStock: items
      .filter((i) => i.active && i.trackStock && i.quantity <= i.minQuantity)
      .map((i) => i.name),
  }
}
