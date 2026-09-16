/**
 * Formatação pura usada na ficha FNRH impressa — separada do componente de
 * apresentação (`components/fnrh-print-view.tsx`) só para ser testável sem
 * precisar renderizar React.
 */

/** `YYYY-MM-DD` → `DD/MM/YYYY`. String vazia se não houver data (campo fica em branco na ficha impressa). */
export function fnrhDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** `"RG", "12.345"` → `"RG: 12.345"`. Sem tipo, mostra só o número; sem número, string vazia. */
export function fnrhDocument(type: string | null, number: string | null): string {
  if (!number) return ''
  return type ? `${type}: ${number}` : number
}

const FNRH_COUNTRY_LABEL: Record<string, string> = { BR: 'Brasil' }

/** Código ISO de país → nome exibível. Códigos sem rótulo mapeado aparecem como o próprio código. */
export function fnrhCountryLabel(code: string | null): string {
  if (!code) return ''
  return FNRH_COUNTRY_LABEL[code] ?? code
}
