/**
 * Contrato da pousada com a Rota (0103): aceite eletrônico no painel
 * (Configurações → Contrato), cópia guardada do texto aceito, versões no
 * /admin → Configurações e a condição de lançamento das 30 primeiras pousadas.
 * O texto é montado e conferido no banco.
 */
export type {
  AcceptedContract,
  ContractAcceptResult,
  ContractAcceptanceSummary,
  ContractState,
  ContractVersionAdmin,
  ContractVersionRef,
} from './types'
export {
  CONTRACT_FIELDS,
  contractNeedsAction,
  contractStatus,
  launchCondition,
  openBrackets,
  parseContractBody,
  unknownContractFields,
  type ContractBlock,
  type ContractStatus,
  type LaunchCondition,
} from './contract'
export { acceptContractSchema, publishContractSchema, saveContractDraftSchema } from './schemas'
