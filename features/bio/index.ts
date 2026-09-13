/**
 * Link da bio — página pública de reserva, pedidos de orçamento e o relatório
 * que a pousada vê no painel.
 */
export {
  QUOTE_STATUS_LABEL,
  type BioPageState,
  type LinkReport,
  type LinkReportDay,
  type LinkReportTotals,
  type QuoteRequest,
  type QuoteRequestStatus,
  type UnmetDemand,
} from './types'
export { buildHighlights, calculateRates, rate, seriesPeak, type ReportHighlight, type ReportRates } from './report'
export {
  quoteRequestSchema,
  quoteStatusSchema,
  reportRangeSchema,
  type QuoteRequestInput,
  type QuoteStatusInput,
  type ReportRangeInput,
} from './schemas'
