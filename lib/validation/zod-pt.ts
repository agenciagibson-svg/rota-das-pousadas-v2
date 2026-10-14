import { z, ZodIssueCode, type ZodErrorMap } from 'zod'

/**
 * Mensagens padrão do Zod em português.
 *
 * Só vale para regra SEM mensagem própria no schema (`.min(2)` em vez de
 * `.min(2, 'Informe o nome.')`). Sem isto, esses casos apareciam embaixo do
 * campo em inglês ("Number must be less than or equal to 50", "Invalid uuid").
 *
 * É registrado uma vez por ambiente: no servidor por `actions/create-action.ts`
 * e, no navegador, por cada formulário que valida no cliente (os que usam
 * `zodResolver` importam este arquivo). Formulário novo com `zodResolver`
 * precisa do mesmo import.
 */
const plural = (n: number | bigint, one: string, many: string) => (Number(n) === 1 ? one : many)

export const zodPtErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: 'Campo obrigatório.' }
      }
      if (issue.expected === 'number' || issue.received === 'nan') {
        return { message: 'Informe um número.' }
      }
      return { message: 'Valor inválido.' }
    case ZodIssueCode.invalid_literal:
    case ZodIssueCode.invalid_union:
    case ZodIssueCode.invalid_union_discriminator:
    case ZodIssueCode.invalid_enum_value:
      return { message: 'Escolha uma das opções.' }
    case ZodIssueCode.invalid_date:
      return { message: 'Data inválida.' }
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'E-mail inválido.' }
      if (issue.validation === 'url') return { message: 'Endereço (URL) inválido.' }
      if (issue.validation === 'uuid') return { message: 'Seleção inválida.' }
      return { message: 'Formato inválido.' }
    case ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return Number(issue.minimum) <= 1
          ? { message: 'Campo obrigatório.' }
          : { message: `Use pelo menos ${issue.minimum} caracteres.` }
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        return {
          message: issue.inclusive
            ? `O mínimo é ${issue.minimum}.`
            : `Precisa ser maior que ${issue.minimum}.`,
        }
      }
      if (issue.type === 'array' || issue.type === 'set') {
        return {
          message: `Informe pelo menos ${issue.minimum} ${plural(issue.minimum, 'item', 'itens')}.`,
        }
      }
      return { message: 'Valor abaixo do mínimo.' }
    case ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: `Use no máximo ${issue.maximum} caracteres.` }
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        return {
          message: issue.inclusive
            ? `O máximo é ${issue.maximum}.`
            : `Precisa ser menor que ${issue.maximum}.`,
        }
      }
      if (issue.type === 'array' || issue.type === 'set') {
        return {
          message: `Use no máximo ${issue.maximum} ${plural(issue.maximum, 'item', 'itens')}.`,
        }
      }
      return { message: 'Valor acima do máximo.' }
    case ZodIssueCode.not_multiple_of:
      return { message: `Precisa ser múltiplo de ${issue.multipleOf}.` }
    case ZodIssueCode.not_finite:
      return { message: 'Informe um número.' }
    case ZodIssueCode.unrecognized_keys:
      return { message: 'Dados inesperados no envio.' }
    default:
      // `custom` (refine/superRefine) sempre traz a mensagem do próprio schema.
      return {
        message: ctx.defaultError === 'Invalid input' ? 'Valor inválido.' : ctx.defaultError,
      }
  }
}

z.setErrorMap(zodPtErrorMap)
