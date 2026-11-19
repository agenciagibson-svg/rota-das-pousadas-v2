/**
 * Regras puras do contrato da pousada (0103), sem I/O.
 *
 * O texto é montado e conferido no banco; aqui ficam só a leitura da situação
 * para a tela e as mesmas checagens do modelo que o banco faz ao publicar,
 * para o master ver o problema antes de clicar.
 */
import type { ContractState } from './types'

/** Campos que o modelo do contrato pode usar (iguais aos da migration 0103). */
export const CONTRACT_FIELDS = [
  { token: '{{razao_social}}', label: 'Razão social ou nome de quem responde pela pousada' },
  { token: '{{documento}}', label: 'CNPJ ou CPF' },
  { token: '{{nome_fantasia}}', label: 'Nome da pousada' },
  { token: '{{endereco}}', label: 'Endereço, cidade/UF e CEP' },
  { token: '{{representante_nome}}', label: 'Nome de quem aceita (o proprietário logado)' },
  { token: '{{representante_email}}', label: 'E-mail de quem aceita' },
] as const

const KNOWN_TOKENS = new Set<string>(CONTRACT_FIELDS.map((f) => f.token))

/** Campos `{{...}}` do modelo que o sistema não conhece (impedem a publicação). */
export function unknownContractFields(template: string): string[] {
  const found = template.match(/\{\{[^{}]*\}\}/g) ?? []
  return [...new Set(found.filter((token) => !KNOWN_TOKENS.has(token)))]
}

/** Trechos `[entre colchetes]` ainda por definir (impedem a publicação). */
export function openBrackets(template: string): string[] {
  return [...new Set(template.match(/\[[^\]]*\]/g) ?? [])]
}

export type ContractBlock = { kind: 'heading' | 'paragraph'; text: string }

/**
 * Quebra o texto do contrato em blocos para a tela. Linha que começa com `#`
 * vira título; o resto vira parágrafo (parágrafos separados por linha em
 * branco). Não interpreta mais nada: o texto aparece como foi aceito.
 */
export function parseContractBody(body: string): ContractBlock[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk): ContractBlock[] => {
      const blocks: ContractBlock[] = []
      let paragraph: string[] = []
      const flush = () => {
        if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
        paragraph = []
      }
      for (const line of chunk.split('\n')) {
        const heading = /^#{1,3}\s+(.*)$/.exec(line.trim())
        if (heading) {
          flush()
          blocks.push({ kind: 'heading', text: heading[1].trim() })
        } else if (line.trim()) {
          paragraph.push(line.trim())
        }
      }
      flush()
      return blocks
    })
}

export type ContractStatus =
  /** Nenhuma versão publicada: a pousada não vê nada sobre contrato. */
  | 'inactive'
  /** Há contrato vigente e a pousada nunca aceitou nenhum. */
  | 'pending'
  /** Aceitou uma versão anterior; a vigente pede novo aceite. */
  | 'reaccept'
  | 'accepted'

export function contractStatus(state: ContractState): ContractStatus {
  if (!state.active) return 'inactive'
  if (state.acceptedCurrent) return 'accepted'
  return state.latestAcceptance ? 'reaccept' : 'pending'
}

/** O contrato precisa de ação da pousada agora? */
export function contractNeedsAction(state: ContractState): boolean {
  const status = contractStatus(state)
  if (status === 'pending') return true
  return status === 'reaccept' && Boolean(state.version?.requiresReaccept)
}

const DAY_MS = 86_400_000

export type LaunchCondition = {
  rank: number
  exemptUntil: string
  /** Dias inteiros que ainda faltam de isenção (0 = acabou). */
  exemptDaysLeft: number
  exemptActive: boolean
  rateLockedUntil: string | null
}

/** Condição de lançamento das 30 primeiras pousadas; `null` para as demais. */
export function launchCondition(
  state: ContractState,
  now: Date = new Date(),
): LaunchCondition | null {
  if (!state.founderRank || !state.commissionExemptUntil) return null
  const left = new Date(state.commissionExemptUntil).getTime() - now.getTime()
  return {
    rank: state.founderRank,
    exemptUntil: state.commissionExemptUntil,
    exemptDaysLeft: Math.max(0, Math.ceil(left / DAY_MS)),
    exemptActive: left > 0,
    rateLockedUntil: state.commissionRateLockedUntil,
  }
}
