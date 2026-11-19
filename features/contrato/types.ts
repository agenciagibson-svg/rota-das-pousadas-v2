/** Contrato da pousada com a Rota (0103). */

export type ContractVersionRef = {
  id: string
  code: string
  title: string
  publishedAt: string | null
  requiresReaccept: boolean
}

export type ContractAcceptanceSummary = {
  acceptedAt: string
  acceptedByName: string
  versionCode: string
  versionTitle: string
  sha256: string
}

/** Situação do contrato da pousada ativa, como o banco devolve. */
export type ContractState = {
  /** Existe versão publicada? Sem ela, nada é pedido à pousada. */
  active: boolean
  version: ContractVersionRef | null
  /** Só o proprietário aceita. */
  canAccept: boolean
  acceptedCurrent: boolean
  latestAcceptance: ContractAcceptanceSummary | null
  /** Texto montado com os dados da pousada; só vem para quem pode aceitar e ainda não aceitou. */
  body: string | null
  bodySha256: string | null
  /** Dados que faltam preencher antes do aceite. */
  missing: string[]
  firstPublishedAt: string | null
  founderRank: number | null
  commissionExemptUntil: string | null
  commissionRateLockedUntil: string | null
}

/** Cópia guardada do contrato aceito. */
export type AcceptedContract = ContractAcceptanceSummary & {
  acceptedByEmail: string
  body: string
  pousadaName: string
}

export type ContractAcceptResult = { acceptedAt: string; versionCode: string; already: boolean }

/** Versão do contrato na tela do master. */
export type ContractVersionAdmin = {
  id: string
  code: string
  title: string
  bodyTemplate: string
  requiresReaccept: boolean
  publishedAt: string | null
  updatedAt: string
  current: boolean
  acceptances: number
}
