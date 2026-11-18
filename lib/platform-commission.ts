/**
 * Comissão da Rota por reserva feita pela plataforma: 5%, sem mensalidade
 * (modelo comercial informado pela equipe em 18/11/2026).
 *
 * Fonte única para os TEXTOS do site (landing, /anunciar, rodapé, página de
 * demonstração). A cobrança não lê este valor: hoje o checkout não desconta
 * nada da reserva.
 */
export const PLATFORM_COMMISSION_RATE = 0.05

/** "5%" — a comissão como aparece nos textos. */
export const PLATFORM_COMMISSION_LABEL = `${Math.round(PLATFORM_COMMISSION_RATE * 100)}%`
