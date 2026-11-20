import { civilNow, DEFAULT_TIMEZONE, isoNightsBetween } from '@/lib/dates'
import { reviewPagePath } from '@/features/estadia/review'

/**
 * Fases do app único da Rota (spec `claude/app-unico-loja-estadia-2026-11-20.md`).
 *
 * O app decide sozinho, a cada abertura, o que mostrar a partir das reservas
 * do hóspede — ninguém aperta botão para trocar:
 *
 * 1. `loja`     sem reserva ativa: busca e reserva de qualquer pousada.
 * 2. `viagem`   pagamento aprovado (`confirmed`) e o check-in ainda não chegou.
 * 3. `estadia`  do dia do check-in (ou `checked_in`) até a estadia fechar.
 * 4. `pos`      estadia fechada há até POS_DAYS dias: avaliação, depois loja.
 *
 * Prioridade quando há mais de uma reserva: estadia > viagem > pós > loja.
 * Pagamento pendente nunca muda a fase (só aparece como aviso).
 *
 * Função pura, sem I/O: o mesmo cálculo serve a porta de entrada `/app`, o
 * índice de `/estadia` e o cartão da loja.
 */

/** Horas depois do horário de check-out do último dia em que a estadia é dada por fechada. */
export const AUTO_CLOSE_HOURS = 4
/** Dias depois do check-out em que o app ainda lembra da estadia (pedido de avaliação). */
export const POS_DAYS = 7
/** Check-out padrão quando a pousada não cadastrou horário. */
const DEFAULT_CHECKOUT_TIME = '12:00'

export type PhaseBooking = {
  id: string
  code: string
  status: string
  checkin: string
  checkout: string
  pousadaName: string
  pousadaSlug: string
  /** "HH:MM" (ou "HH:MM:SS"); vazio = DEFAULT_CHECKOUT_TIME. */
  checkoutTime: string
  /** Fuso da pousada; vazio = Brasília. */
  timezone: string
  paymentDueAt: string | null
}

export type AppPhase =
  | { kind: 'loja' }
  | { kind: 'viagem'; booking: PhaseBooking; daysLeft: number }
  | { kind: 'estadia'; booking: PhaseBooking }
  | { kind: 'escolher'; bookings: PhaseBooking[] }
  | { kind: 'pos'; booking: PhaseBooking }

export type AppState = {
  phase: AppPhase
  /** Reservas esperando pagamento (ainda no prazo). Nunca mudam a fase. */
  pending: PhaseBooking[]
  /** Viagens confirmadas futuras além da que define a fase ("Próxima viagem"). */
  upcoming: PhaseBooking[]
}

type Clock = { today: string; minutes: number }

function clockAt(now: Date, timezone: string): Clock {
  const civil = civilNow(now, timezone || DEFAULT_TIMEZONE)
  return {
    today: civil.toISOString().slice(0, 10),
    minutes: civil.getUTCHours() * 60 + civil.getUTCMinutes(),
  }
}

function timeToMinutes(value: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!m) return timeToMinutes(DEFAULT_CHECKOUT_TIME)
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return timeToMinutes(DEFAULT_CHECKOUT_TIME)
  return h * 60 + min
}

const LIVE = new Set(['confirmed', 'checked_in'])

/**
 * A estadia já fechou para o app? Fechada pela pousada (`checked_out`), ou a
 * data passou do check-out, ou é o último dia e já se foram AUTO_CLOSE_HOURS
 * depois do horário de check-out (a pousada esqueceu de fechar).
 */
export function stayClosed(b: PhaseBooking, now: Date): boolean {
  if (b.status === 'checked_out') return true
  if (!LIVE.has(b.status)) return false
  const { today, minutes } = clockAt(now, b.timezone)
  if (today > b.checkout) return true
  if (today < b.checkout) return false
  return minutes >= timeToMinutes(b.checkoutTime) + AUTO_CLOSE_HOURS * 60
}

/** Em estadia agora: chegou o dia do check-in (ou a pousada já fez o check-in) e não fechou. */
export function inStay(b: PhaseBooking, now: Date): boolean {
  if (!LIVE.has(b.status) || stayClosed(b, now)) return false
  if (b.status === 'checked_in') return true
  return clockAt(now, b.timezone).today >= b.checkin
}

function isUpcoming(b: PhaseBooking, now: Date): boolean {
  return b.status === 'confirmed' && clockAt(now, b.timezone).today < b.checkin
}

function inPosWindow(b: PhaseBooking, now: Date): boolean {
  if (!LIVE.has(b.status) && b.status !== 'checked_out') return false
  if (!stayClosed(b, now)) return false
  const { today } = clockAt(now, b.timezone)
  return isoNightsBetween(b.checkout, today) <= POS_DAYS
}

function isPendingPayment(b: PhaseBooking, now: Date): boolean {
  if (b.status !== 'pending') return false
  return !b.paymentDueAt || new Date(b.paymentDueAt).getTime() > now.getTime()
}

const byCheckin = (a: PhaseBooking, b: PhaseBooking) =>
  a.checkin.localeCompare(b.checkin) || a.id.localeCompare(b.id)

export function resolveAppState(bookings: PhaseBooking[], now: Date = new Date()): AppState {
  const pending = bookings.filter((b) => isPendingPayment(b, now)).sort(byCheckin)
  const staying = bookings.filter((b) => inStay(b, now)).sort(byCheckin)
  const future = bookings.filter((b) => isUpcoming(b, now)).sort(byCheckin)

  let phase: AppPhase
  if (staying.length === 1) {
    phase = { kind: 'estadia', booking: staying[0]! }
  } else if (staying.length > 1) {
    phase = { kind: 'escolher', bookings: staying }
  } else if (future.length > 0) {
    const next = future[0]!
    phase = {
      kind: 'viagem',
      booking: next,
      daysLeft: isoNightsBetween(clockAt(now, next.timezone).today, next.checkin),
    }
  } else {
    // A mais recente: quem acabou de sair é quem deve ser lembrado.
    const closed = bookings
      .filter((b) => inPosWindow(b, now))
      .sort((a, b) => b.checkout.localeCompare(a.checkout) || a.id.localeCompare(b.id))
    phase = closed[0] ? { kind: 'pos', booking: closed[0] } : { kind: 'loja' }
  }

  const mainId = phase.kind === 'viagem' ? phase.booking.id : null
  return { phase, pending, upcoming: future.filter((b) => b.id !== mainId) }
}

/** Para onde a porta de entrada do app (`/app`) leva em cada fase. */
export function phaseEntryPath(phase: AppPhase): string {
  switch (phase.kind) {
    case 'estadia':
    case 'viagem':
      return `/estadia/${phase.booking.id}`
    case 'escolher':
      return '/estadia'
    default:
      return '/'
  }
}

/** Cartão da fase na loja (home): o atalho de volta para a viagem ou a estadia. */
export type PhaseCard = {
  kind: 'estadia' | 'escolher' | 'viagem' | 'pos' | 'pendente'
  eyebrow: string
  title: string
  cta: string
  href: string
  /** Só o pós-estadia pode ser dispensado (some até a próxima estadia). */
  dismissKey?: string
}

export function phaseCard(state: AppState): PhaseCard | null {
  const { phase } = state
  switch (phase.kind) {
    case 'estadia':
      return {
        kind: 'estadia',
        eyebrow: 'Você está hospedado',
        title: phase.booking.pousadaName,
        cta: 'Abrir sua estadia',
        href: `/estadia/${phase.booking.id}`,
      }
    case 'escolher':
      return {
        kind: 'escolher',
        eyebrow: 'Você está hospedado',
        title: `${phase.bookings.length} estadias em curso`,
        cta: 'Escolher estadia',
        href: '/estadia',
      }
    case 'viagem': {
      const d = phase.daysLeft
      return {
        kind: 'viagem',
        eyebrow: d <= 1 ? 'Sua viagem é amanhã' : `Sua viagem · faltam ${d} dias`,
        title: phase.booking.pousadaName,
        cta: 'Preparar a viagem',
        href: `/estadia/${phase.booking.id}`,
      }
    }
    case 'pos':
      return {
        kind: 'pos',
        eyebrow: 'Como foi a estadia?',
        title: phase.booking.pousadaName,
        cta: 'Avaliar',
        href: reviewPagePath(phase.booking.id),
        dismissKey: `rp_pos_${phase.booking.id}`,
      }
    case 'loja': {
      const p = state.pending[0]
      if (!p) return null
      return {
        kind: 'pendente',
        eyebrow: 'Pagamento pendente',
        title: p.pousadaName,
        cta: 'Pagar agora',
        href: `/pousada/${p.pousadaSlug}/reservar/${p.id}/pagamento`,
      }
    }
  }
}
