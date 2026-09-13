import { z } from 'zod'

/**
 * Validação dos formulários de canal.
 *
 * Nunca usar `.transform()` aqui — `createAction` exige `Input` = `Output` do
 * Zod, senão a inferência de tipo da action quebra (mesma restrição anotada em
 * `lib/validation/br.ts` e `features/admin/schemas.ts`).
 */

/**
 * O link do feed precisa ser HTTPS. Não é preciosismo: a URL de um calendário
 * de OTA carrega um token na própria query, e em HTTP ele viajaria em claro.
 */
const icalUrlSchema = z
  .string()
  .trim()
  .url('Informe uma URL válida.')
  .max(1000, 'URL longa demais.')
  .refine((value) => value.toLowerCase().startsWith('https://'), 'O link precisa começar com https://')

export const channelProviderSchema = z.enum(['airbnb', 'booking', 'outro'])

export const saveChannelSchema = z.object({
  roomId: z.string().uuid('Acomodação inválida.'),
  provider: channelProviderSchema,
  label: z.string().trim().max(80),
  /** Vazio = canal só de exportação; a pousada publica mas não importa nada. */
  importUrl: icalUrlSchema.or(z.literal('')),
})
export type SaveChannelInput = z.infer<typeof saveChannelSchema>

export const channelIdSchema = z.object({
  calendarId: z.string().uuid('Canal inválido.'),
})
export type ChannelIdInput = z.infer<typeof channelIdSchema>
