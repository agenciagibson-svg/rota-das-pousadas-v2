/** Comissão da Rota por reserva (0104). Valores em reais. */

export type CommissionMonth = {
  /** Primeiro dia do mês do check-out (`YYYY-MM-01`). */
  month: string
  bookings: number
  base: number
  /** Comissão devida (reservas não isentas). */
  due: number
  /** Comissão dispensada pela isenção de lançamento. */
  waived: number
}

export type CommissionItem = {
  bookingId: string
  code: string
  checkin: string
  checkout: string
  origin: string
  base: number
  rate: number
  amount: number
  exempt: boolean
}

/** Extrato de comissão de uma pousada. */
export type CommissionStatement = {
  rate: number
  hasContract: boolean
  exemptUntil: string | null
  /** Mês que está aberto. */
  month: string
  /** Até 12 meses com comissão, do mais recente para o mais antigo. */
  months: CommissionMonth[]
  /** Reservas do mês aberto. */
  items: CommissionItem[]
}

export type PlatformCommissionMonth = CommissionMonth & { pousadas: number }

export type PlatformCommissionPousada = {
  pousadaId: string
  name: string
  founderRank: number | null
  exemptUntil: string | null
  bookings: number
  base: number
  due: number
  waived: number
}

/** Comissões de todas as pousadas (admin → Financeiro). */
export type PlatformCommissions = {
  rate: number
  month: string
  months: PlatformCommissionMonth[]
  pousadas: PlatformCommissionPousada[]
}
