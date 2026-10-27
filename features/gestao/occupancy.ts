/**
 * Mapa de ocupação ("tape chart") — lógica pura, sem React e sem I/O.
 *
 * Linhas = quartos, colunas = NOITES. A coluna do dia D é a noite de D para
 * D+1, igual a `bookings.checkout` exclusivo: uma reserva de 10 a 12 ocupa as
 * colunas 10 e 11, e a 12 já aparece livre para a próxima entrada.
 *
 * As regras de mudança (`moveCapabilities`, `validateMoveTarget`) espelham a
 * RPC `move_booking` (0096) e a checagem de conflito (`findMoveConflict`)
 * espelha `assert_room_available_for_booking` — aqui é só para a tela avisar
 * na hora; quem decide é o banco. O cliente só conhece o que está na janela
 * carregada, então um conflito fora dela aparece só quando o banco recusa.
 */
import { addDaysToISODate, isoNightsBetween } from '@/lib/dates'
import type { BookingOrigin, BookingStatus } from '@/features/reservas/types'

export type OccupancyRoom = {
  id: string
  name: string
  /** `coalesce(capacity_max, capacity)` — o mesmo teto da RPC. */
  capacity: number
  petsAllowed: boolean
  /** Status operacional em manutenção/bloqueado: o banco não aceita reserva. */
  unavailable: boolean
}

export type OccupancyBooking = {
  id: string
  code: string
  roomId: string
  guestName: string
  checkin: string
  checkout: string
  status: BookingStatus
  origin: BookingOrigin
  /** Adultos + crianças (bebês não contam na capacidade, como na RPC). */
  guests: number
  pets: boolean
  subtotal: number
  total: number
  amountReceived: number
  /** Concorrência otimista: a RPC recusa se mudou desde a leitura. */
  version: number
}

/** Faixa fixa no mapa: bloqueio da pousada ou noite vendida num canal (iCal). */
export type OccupancyHold = {
  id: string
  roomId: string
  /** Primeira noite. */
  startsOn: string
  /** Exclusivo, como `checkout`. */
  endsOn: string
  kind: 'block' | 'channel'
  label: string
}

export type OccupancyBoard = {
  rooms: OccupancyRoom[]
  bookings: OccupancyBooking[]
  holds: OccupancyHold[]
  /** Primeira noite da janela. */
  from: string
  days: number
  /** Hoje no fuso da pousada. */
  today: string
}

export type MoveTarget = { roomId: string; checkin: string; checkout: string }

/** Reservas que vêm de canal: espelho da OTA, não se movem pelo mapa (0096). */
export const CHANNEL_ORIGINS: readonly BookingOrigin[] = ['airbnb', 'booking_com', 'expedia']

/** Status que ocupam o quarto (mesmo WHERE da EXCLUDE da 0033). */
const OCCUPYING: readonly BookingStatus[] = ['pending', 'confirmed', 'checked_in']

/** Janelas oferecidas na tela. */
export const WINDOW_OPTIONS = [14, 30] as const
export type WindowDays = (typeof WINDOW_OPTIONS)[number]

const CHANNEL_NAME: Partial<Record<BookingOrigin, string>> = {
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  expedia: 'Expedia',
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd
}

/** As noites da janela, em ordem. */
export function windowNights(from: string, days: number): string[] {
  return Array.from({ length: Math.max(0, days) }, (_, i) => addDaysToISODate(from, i))
}

/** Janela pedida pela URL: `inicio` válido ou hoje − 1 (mostra quem saiu ontem). */
export function resolveWindow(
  today: string,
  params: { inicio?: string; dias?: string },
): { from: string; days: WindowDays } {
  const days: WindowDays = params.dias === '30' ? 30 : 14
  const valid =
    typeof params.inicio === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.inicio) &&
    !Number.isNaN(Date.parse(`${params.inicio}T00:00:00Z`)) &&
    // Evita janelas absurdas digitadas na URL (o banco não precisa varrer décadas).
    Math.abs(isoNightsBetween(today, params.inicio)) <= 3 * 366
  return { from: valid ? params.inicio! : addDaysToISODate(today, -1), days }
}

/**
 * Posição de uma faixa [início, fim) na janela, em colunas. `null` quando não
 * aparece. `cutStart`/`cutEnd`: a faixa continua antes/depois da janela.
 */
export function barPlacement(
  start: string,
  end: string,
  from: string,
  days: number,
): { start: number; span: number; cutStart: boolean; cutEnd: boolean } | null {
  const first = isoNightsBetween(from, start)
  const last = isoNightsBetween(from, end)
  const s = Math.max(0, first)
  const e = Math.min(days, last)
  if (e <= s) return null
  return { start: s, span: e - s, cutStart: first < 0, cutEnd: last > days }
}

/** Deslocamento em pixels → dias (ou linhas), arredondado para a célula mais próxima. */
export function cellsFromPixels(delta: number, cellSize: number): number {
  if (!(cellSize > 0)) return 0
  const n = Math.round(delta / cellSize)
  return n === 0 ? 0 : n // evita -0
}

export function isChannelBooking(b: Pick<OccupancyBooking, 'origin'>): boolean {
  return CHANNEL_ORIGINS.includes(b.origin)
}

export type MoveCapabilities = {
  /** Trocar quarto e/ou datas mantendo a duração (arrastar a barra). */
  canMove: boolean
  /** Mudar só a saída (puxar a borda). */
  canResize: boolean
  /** Por que não dá (ou o limite), para mostrar ao usuário. */
  reason?: string
}

/** O que a pessoa pode fazer com esta reserva no mapa (espelha a 0096). */
export function moveCapabilities(b: OccupancyBooking): MoveCapabilities {
  if (isChannelBooking(b)) {
    return {
      canMove: false,
      canResize: false,
      reason: `Reserva do ${CHANNEL_NAME[b.origin]}: mude primeiro no canal e depois ajuste em Editar reserva.`,
    }
  }
  if (b.status === 'checked_in') {
    return { canMove: false, canResize: true, reason: 'Hóspede em estadia: só a saída pode mudar.' }
  }
  if (b.status === 'pending' || b.status === 'confirmed') return { canMove: true, canResize: true }
  return {
    canMove: false,
    canResize: false,
    reason: 'Só dá para mover reserva aguardando pagamento, confirmada ou em estadia.',
  }
}

/** Destino depois de arrastar `dayDelta` dias para o quarto `roomId`. */
export function draggedTarget(
  b: OccupancyBooking,
  mode: 'move' | 'resize',
  dayDelta: number,
  roomId: string,
): MoveTarget {
  if (mode === 'resize') {
    const minCheckout = addDaysToISODate(b.checkin, 1)
    const checkout = addDaysToISODate(b.checkout, dayDelta)
    return {
      roomId: b.roomId,
      checkin: b.checkin,
      checkout: checkout < minCheckout ? minCheckout : checkout,
    }
  }
  return {
    roomId,
    checkin: addDaysToISODate(b.checkin, dayDelta),
    checkout: addDaysToISODate(b.checkout, dayDelta),
  }
}

export function isSameTarget(b: OccupancyBooking, t: MoveTarget): boolean {
  return b.roomId === t.roomId && b.checkin === t.checkin && b.checkout === t.checkout
}

/** Regras de status e data da 0096. Devolve a mensagem de erro ou `null`. */
export function validateMoveTarget(
  b: OccupancyBooking,
  t: MoveTarget,
  today: string,
): string | null {
  if (!t.roomId || !t.checkin || !t.checkout) return 'Informe o quarto e as datas.'
  if (t.checkout <= t.checkin) return 'A data de saída deve ser posterior à de entrada.'
  if (isoNightsBetween(t.checkin, t.checkout) > 366) return 'Período longo demais.'
  const caps = moveCapabilities(b)
  if (!caps.canMove && !caps.canResize) return caps.reason ?? 'Esta reserva não pode ser movida.'
  if (isSameTarget(b, t)) return 'A reserva já está nesse quarto e nessas datas.'
  if (b.status === 'checked_in') {
    if (t.roomId !== b.roomId || t.checkin !== b.checkin)
      return 'O hóspede já fez check-in: aqui só dá para mudar a data de saída.'
    if (t.checkout < today) return 'A nova saída não pode ser antes de hoje.'
    return null
  }
  if (t.checkin !== b.checkin && t.checkin < today) return 'A nova entrada não pode ser no passado.'
  if (t.checkout !== b.checkout && t.checkout <= today)
    return 'A nova saída precisa ser depois de hoje.'
  return null
}

export type MoveConflict =
  | { kind: 'room'; message: string }
  | { kind: 'booking'; message: string; bookingId: string }
  | { kind: 'block' | 'channel'; message: string }

/**
 * Conflito do destino com o que está carregado: quarto (capacidade, pets,
 * manutenção), outras reservas, bloqueios e noites vendidas no canal.
 */
export function findMoveConflict(
  board: Pick<OccupancyBoard, 'rooms' | 'bookings' | 'holds'>,
  b: OccupancyBooking,
  t: MoveTarget,
): MoveConflict | null {
  const room = board.rooms.find((r) => r.id === t.roomId)
  if (!room) return { kind: 'room', message: 'Quarto não encontrado nesta pousada.' }
  if (room.unavailable)
    return { kind: 'room', message: `${room.name} está em manutenção ou bloqueado.` }
  if (b.guests > room.capacity)
    return {
      kind: 'room',
      message: `${room.name} comporta até ${room.capacity} ${room.capacity === 1 ? 'hóspede' : 'hóspedes'}.`,
    }
  if (b.pets && !room.petsAllowed) return { kind: 'room', message: `${room.name} não aceita pets.` }

  const other = board.bookings.find(
    (o) =>
      o.id !== b.id &&
      o.roomId === t.roomId &&
      OCCUPYING.includes(o.status) &&
      overlaps(o.checkin, o.checkout, t.checkin, t.checkout),
  )
  if (other)
    return {
      kind: 'booking',
      bookingId: other.id,
      message: `Conflita com a reserva de ${other.guestName} (${other.code}).`,
    }

  for (const h of board.holds) {
    if (h.roomId !== t.roomId || !overlaps(h.startsOn, h.endsOn, t.checkin, t.checkout)) continue
    if (h.kind === 'block')
      return { kind: 'block', message: `${room.name} está bloqueado nesse período.` }
    // Eco do iCal (0062): o trecho do canal dentro das noites que a reserva já
    // ocupava neste quarto não conta.
    const echo =
      b.roomId === t.roomId &&
      (h.startsOn > t.checkin ? h.startsOn : t.checkin) >= b.checkin &&
      (h.endsOn < t.checkout ? h.endsOn : t.checkout) <= b.checkout
    if (!echo)
      return { kind: 'channel', message: `${room.name} já está ocupado no canal (${h.label}).` }
  }
  return null
}

/** Noites ocupadas (reserva ou faixa) por quarto, para saber onde a célula é "livre". */
export function busyNightsByRoom(
  board: Pick<OccupancyBoard, 'bookings' | 'holds'>,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const add = (roomId: string, start: string, end: string) => {
    let set = out.get(roomId)
    if (!set) out.set(roomId, (set = new Set()))
    const n = isoNightsBetween(start, end)
    for (let i = 0; i < n && i <= 400; i++) set.add(addDaysToISODate(start, i))
  }
  for (const b of board.bookings)
    if (OCCUPYING.includes(b.status)) add(b.roomId, b.checkin, b.checkout)
  for (const h of board.holds) add(h.roomId, h.startsOn, h.endsOn)
  return out
}

export type PriceEffect = {
  /** Total combinado hoje (o que fica se a pessoa não escolher o valor novo). */
  currentTotal: number
  /** Total com as diárias das tarifas para o destino; `null` sem cotação. */
  repricedTotal: number | null
  /** repriced − current. */
  difference: number | null
  /** Já tem dinheiro recebido: mudar valor exige escolha explícita (e nunca abaixo do pago). */
  paid: boolean
  /** O valor novo fica abaixo do que já foi pago — o banco recusa essa opção. */
  repricedBelowPaid: boolean
}

/**
 * Efeito no valor: o total combinado fica como está; o recalculado troca só as
 * diárias (subtotal) pelas das tarifas e mantém taxa, desconto, acréscimo e
 * serviços — a mesma conta da 0096.
 */
export function priceEffect(
  b: Pick<OccupancyBooking, 'subtotal' | 'total' | 'amountReceived'>,
  quotedNights: number | null,
): PriceEffect {
  const repriced = quotedNights === null ? null : Math.max(0, b.total - b.subtotal + quotedNights)
  return {
    currentTotal: b.total,
    repricedTotal: repriced,
    difference: repriced === null ? null : repriced - b.total,
    paid: b.amountReceived > 0,
    repricedBelowPaid: repriced !== null && repriced < b.amountReceived,
  }
}

/** "26/10" — rótulo curto da coluna. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "seg" — dia da semana da data civil (sem fuso). */
export function weekdayShort(iso: string): string {
  return WEEKDAY[new Date(`${iso}T12:00:00Z`).getUTCDay()]!
}

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Lê o que `newBookingHref` mandou na URL de "Nova reserva". Só aceita quarto
 * da lista da pousada e datas válidas; o resto é ignorado (o formulário abre vazio).
 */
export function parseNewBookingPrefill(
  params: { quarto?: string; entrada?: string; saida?: string },
  roomIds: string[],
): { roomId?: string; checkin?: string; checkout?: string } {
  const valid = (d?: string) =>
    !!d && CIVIL_DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`))
  const checkin = valid(params.entrada) ? params.entrada : undefined
  const checkout =
    checkin && valid(params.saida) && params.saida! > checkin ? params.saida : undefined
  return {
    roomId: params.quarto && roomIds.includes(params.quarto) ? params.quarto : undefined,
    checkin,
    checkout: checkout ?? (checkin ? addDaysToISODate(checkin, 1) : undefined),
  }
}

/** Link de "Nova reserva" já com quarto e datas (o formulário lê a query string). */
export function newBookingHref(roomId: string, checkin: string): string {
  const params = new URLSearchParams({
    quarto: roomId,
    entrada: checkin,
    saida: addDaysToISODate(checkin, 1),
  })
  return `/dashboard/reservas/nova?${params.toString()}`
}
