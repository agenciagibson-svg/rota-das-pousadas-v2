import { z } from 'zod'

/** Tamanho máximo da foto já reduzida no navegador (o bucket aceita até 1 MB). */
export const TIP_PHOTO_MAX_BYTES = 950 * 1024

export const tipSchema = z.object({
  postSlug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Guia inválido.')
    .max(120),
  authorName: z
    .string()
    .trim()
    .min(2, 'Informe como quer aparecer (2 a 40 letras).')
    .max(40, 'Use até 40 letras.'),
  authorCity: z.string().trim().max(40, 'Use até 40 letras.'),
  body: z
    .string()
    .trim()
    .min(20, 'Conte um pouco mais (pelo menos 20 caracteres).')
    .max(600, 'Use até 600 caracteres.'),
  photo: z
    .instanceof(Blob)
    .nullable()
    .refine((f) => !f || f.type === 'image/jpeg', 'Envie a foto em JPG.')
    .refine((f) => !f || f.size <= TIP_PHOTO_MAX_BYTES, 'A foto ficou grande demais. Tente outra.'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Para publicar, marque a autorização.' }),
  }),
  turnstileToken: z.string(),
})

export type TipInput = z.output<typeof tipSchema>

/** O formulário manda FormData (por causa da foto); aqui vira o objeto validado. */
export const tipFormSchema = z
  .instanceof(FormData)
  .transform((fd) => {
    const photo = fd.get('photo')
    return {
      postSlug: String(fd.get('postSlug') ?? ''),
      authorName: String(fd.get('authorName') ?? ''),
      authorCity: String(fd.get('authorCity') ?? ''),
      body: String(fd.get('body') ?? ''),
      photo: photo instanceof Blob && photo.size > 0 ? photo : null,
      consent: fd.get('consent') === 'on',
      turnstileToken: String(fd.get('turnstileToken') ?? ''),
    }
  })
  .pipe(tipSchema)

export const moderateTipSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['aprovada', 'recusada']),
})

/** Painel: tirar um guia do ar ou voltar (0113). */
export const guideVisibilitySchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(120),
  hidden: z.boolean(),
  reason: z.string().trim().max(200).default(''),
})
