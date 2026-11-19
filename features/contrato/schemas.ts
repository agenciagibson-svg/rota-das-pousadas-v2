import { z } from 'zod'

/**
 * Aceite do contrato (0103). O hash é o do texto que a tela mostrou: o banco
 * monta o texto de novo e recusa se não bater. `confirm` é a caixa "li e
 * aceito" — sem ela marcada a ação nem chega ao banco.
 *
 * Sem `.optional()`/`.default()`/`.transform()`: no `createAction` o tipo de
 * entrada e o de saída precisam ser o mesmo.
 */
export const acceptContractSchema = z.object({
  versionId: z.string().uuid('Contrato inválido. Recarregue a página.'),
  bodySha256: z.string().regex(/^[0-9a-f]{64}$/, 'Contrato inválido. Recarregue a página.'),
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Marque que você leu e aceita o contrato.' }),
  }),
})
export type AcceptContractInput = z.infer<typeof acceptContractSchema>

const versionCode = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9.-]{2,39}$/,
    'Use de 3 a 40 letras minúsculas, números, ponto ou hífen (ex.: 2026-12-v1).',
  )

/** Rascunho de versão do contrato (master). O banco repete as checagens. */
export const saveContractDraftSchema = z.object({
  code: versionCode,
  title: z.string().min(3, 'Informe o título.').max(200, 'Título longo demais.'),
  bodyTemplate: z
    .string()
    .min(200, 'O texto do contrato está curto demais.')
    .max(200_000, 'O texto passou do limite de 200 mil caracteres.'),
  requiresReaccept: z.boolean(),
})
export type SaveContractDraftInput = z.infer<typeof saveContractDraftSchema>

export const publishContractSchema = z.object({ code: versionCode })
