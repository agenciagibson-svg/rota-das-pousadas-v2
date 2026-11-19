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
