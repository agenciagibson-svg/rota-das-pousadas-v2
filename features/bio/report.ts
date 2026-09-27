/**
 * Leitura do relatório do link — puro e testável.
 *
 * A conta em si é trivial; o que este módulo carrega é a *interpretação*. Um
 * painel que só empilha números grandes não ajuda ninguém: o dono da pousada
 * precisa saber o que fazer na segunda-feira. Por isso cada taxa aqui vem
 * acompanhada da leitura que ela permite.
 */
import type { LinkReport, LinkReportTotals, UnmetDemand } from './types'
import { formatBRL } from '@/lib/format'

/** Percentual inteiro de 0 a 100. Divisor zero devolve 0, nunca NaN nem Infinity. */
export function rate(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0
  return Math.min(100, Math.round((part / whole) * 100))
}

export type ReportRates = {
  /** De quem abriu o link, quantos chegaram a consultar datas. */
  searchRate: number
  /** De quem consultou datas, quantos reservaram ou pediram orçamento. */
  conversionRate: number
  /** Das consultas, quantas bateram em porta fechada. */
  unavailableRate: number
}

export function calculateRates(totals: LinkReportTotals): ReportRates {
  return {
    searchRate: rate(totals.searches, totals.views),
    conversionRate: rate(totals.bookings + totals.quotes, totals.searches),
    unavailableRate: rate(totals.searchesWithoutAvailability, totals.searches),
  }
}

export type ReportHighlight = {
  tone: 'bom' | 'atencao' | 'neutro'
  title: string
  detail: string
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}`
}

function periodo(item: UnmetDemand): string {
  if (!item.checkout) return fmtDate(item.checkin)
  return `${fmtDate(item.checkin)} a ${fmtDate(item.checkout)}`
}

/**
 * A frase que o relatório existe para dizer.
 *
 * Ordem deliberada: demanda perdida vem antes de qualquer número bom, porque é
 * a única linha que gera ação imediata — abrir inventário, rever preço, chamar
 * quem ficou na espera. Elogio não muda a segunda-feira de ninguém.
 */
export function buildHighlights(report: LinkReport): ReportHighlight[] {
  const out: ReportHighlight[] = []
  const { totals, unmetDemand } = report
  const rates = calculateRates(totals)

  const maior = unmetDemand.reduce<UnmetDemand | null>(
    (acc, item) => (!acc || item.tries > acc.tries ? item : acc),
    null,
  )

  if (maior && maior.tries >= 2) {
    out.push({
      tone: 'atencao',
      title: `${maior.tries} pessoas procuraram ${periodo(maior)} e não havia vaga`,
      detail:
        maior.guests > 0
          ? `Para ${maior.guests} ${maior.guests === 1 ? 'hóspede' : 'hóspedes'}. Vale checar se dá para abrir acomodação ou avisar quem procurou.`
          : 'Vale checar se dá para abrir acomodação nesse período.',
    })
  }

  if (totals.bookings > 0) {
    out.push({
      tone: 'bom',
      title: `${totals.bookings} ${totals.bookings === 1 ? 'reserva veio' : 'reservas vieram'} pelo link`,
      detail: `${formatBRL(totals.revenue)} em reservas ativas, sem comissão de canal.`,
    })
  }

  if (totals.quotes > 0) {
    out.push({
      tone: 'neutro',
      title: `${totals.quotes} ${totals.quotes === 1 ? 'pedido de orçamento' : 'pedidos de orçamento'}`,
      detail: 'Pedidos sem resposta esfriam rápido — responda ainda hoje.',
    })
  }

  if (totals.views > 0 && totals.searches === 0) {
    out.push({
      tone: 'atencao',
      title: 'Gente abriu o link, mas ninguém consultou datas',
      detail: 'Costuma ser preço ausente, foto faltando ou página lenta no celular.',
    })
  } else if (totals.searches > 0 && rates.conversionRate === 0) {
    out.push({
      tone: 'atencao',
      title: 'Consultaram datas, mas ninguém reservou',
      detail:
        rates.unavailableRate >= 50
          ? 'Metade das consultas não encontrou vaga — o problema é disponibilidade, não a página.'
          : 'Havia vaga e mesmo assim não fecharam. Vale revisar diária e política de cancelamento.',
    })
  }

  if (out.length === 0) {
    out.push({
      tone: 'neutro',
      title: 'Ainda sem movimento no link',
      detail: 'Publique o endereço na bio do Instagram e nos stories para começar a medir.',
    })
  }

  return out
}

/** Maior valor da série — usado para dar escala ao gráfico sem inventar teto. */
export function seriesPeak(report: LinkReport): number {
  return report.daily.reduce((max, d) => Math.max(max, d.views, d.searches, d.bookings), 0)
}
