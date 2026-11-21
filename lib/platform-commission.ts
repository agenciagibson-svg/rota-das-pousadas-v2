/**
 * Comissão da Rota por reserva feita pela plataforma: 6%, sem mensalidade
 * (modelo comercial confirmado em 19/11/2026; eram 5% nos textos de 18/11).
 *
 * Fonte única para os TEXTOS do site (landing, /anunciar, rodapé, página de
 * demonstração). A cobrança não lê este valor: hoje o checkout não desconta
 * nada da reserva.
 */
export const PLATFORM_COMMISSION_RATE = 0.06

/** "6%" — a comissão como aparece nos textos. */
export const PLATFORM_COMMISSION_LABEL = `${Math.round(PLATFORM_COMMISSION_RATE * 100)}%`

/**
 * Condição de lançamento das 30 primeiras pousadas ("fundadoras", 0114):
 * 60 dias sem comissão, depois 3% por 12 meses, depois o percentual normal.
 */
export const FOUNDER_EXEMPT_DAYS = 60
export const FOUNDER_COMMISSION_RATE = 0.03
export const FOUNDER_RATE_MONTHS = 12
export const FOUNDER_SLOTS = 30

/** "3%" */
export const FOUNDER_COMMISSION_LABEL = `${Math.round(FOUNDER_COMMISSION_RATE * 100)}%`
