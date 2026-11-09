/**
 * Dados do responsável pela plataforma nos Termos de Uso e na Política de
 * Privacidade. Razão social e CNPJ ficam `null` até serem informados — a
 * página só mostra o que estiver preenchido. Atualize `updatedAt` sempre que
 * o texto dos documentos mudar.
 */
export const LEGAL = {
  brand: 'Rota das Pousadas',
  site: 'rotadaspousadas.com.br',
  legalName: 'DME Soluções Integradas Ltda' as string | null,
  cnpj: '43.133.012/0001-05' as string | null,
  /** Endereço da sede (Decreto 7.962/2013: comércio eletrônico identifica o fornecedor). */
  address: 'Rua Ronan Manoel Pereira, 992, Santa Mônica, Uberlândia/MG, CEP 38408-274' as
    string | null,
  /** Canal para dúvidas, suporte e pedidos sobre dados pessoais (LGPD). */
  contactEmail: 'agenciagibson@gmail.com',
  updatedAt: '9 de novembro de 2026',
} as const

/** "Rota das Pousadas, operada por X (CNPJ Y)" — só com o que estiver preenchido. */
export function operatorLine(): string {
  const parts: string[] = [LEGAL.brand]
  if (LEGAL.legalName) {
    parts.push(`operada por ${LEGAL.legalName}${LEGAL.cnpj ? `, CNPJ ${LEGAL.cnpj}` : ''}`)
  }
  return parts.join(', ')
}

/** Linha do rodapé: razão social, CNPJ e endereço — só o que estiver preenchido. */
export function companyFooterLine(): string | null {
  if (!LEGAL.legalName) return null
  return [LEGAL.legalName, LEGAL.cnpj && `CNPJ ${LEGAL.cnpj}`, LEGAL.address]
    .filter(Boolean)
    .join(' · ')
}
