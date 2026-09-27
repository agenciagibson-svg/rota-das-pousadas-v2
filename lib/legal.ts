/**
 * Dados do responsável pela plataforma nos Termos de Uso e na Política de
 * Privacidade. Razão social e CNPJ ficam `null` até serem informados — a
 * página só mostra o que estiver preenchido. Atualize `updatedAt` sempre que
 * o texto dos documentos mudar.
 */
export const LEGAL = {
  brand: 'Rota das Pousadas',
  site: 'rotadaspousadas.com.br',
  legalName: null as string | null,
  cnpj: null as string | null,
  /** Canal para dúvidas, suporte e pedidos sobre dados pessoais (LGPD). */
  contactEmail: 'agenciagibson@gmail.com',
  updatedAt: '27 de setembro de 2026',
} as const

/** "Rota das Pousadas, operada por X (CNPJ Y)" — só com o que estiver preenchido. */
export function operatorLine(): string {
  const parts: string[] = [LEGAL.brand]
  if (LEGAL.legalName) {
    parts.push(`operada por ${LEGAL.legalName}${LEGAL.cnpj ? `, CNPJ ${LEGAL.cnpj}` : ''}`)
  }
  return parts.join(', ')
}
