/**
 * Configuração guiada da pousada (puro, sem I/O).
 *
 * Cada passo diz se está feito a partir do que já está gravado — o dono nunca
 * marca à mão. Assim o checklist não mente: se ele apagar a chave Pix, o passo
 * volta a aparecer como pendente.
 */

export type SetupStepId =
  | 'fotos'
  | 'descricao'
  | 'politica'
  | 'contato'
  | 'acomodacoes'
  | 'pix'
  | 'assinatura'
  | 'cartao'
  | 'canais'
  | 'equipe'

export type SetupStep = {
  id: SetupStepId
  label: string
  hint: string
  href: string
  done: boolean
  optional: boolean
}

export type SetupInput = {
  gallery: string[]
  image: string
  description: string
  checkinTime: string
  checkoutTime: string
  cancellationPolicy: string
  whatsapp: string
  notificationEmail: string
  /** Acomodações ativas com diária > 0. */
  sellableRooms: number
  /** Acomodações ativas sem foto própria (galeria do quarto vazia). */
  roomsWithoutPhotos: number
  pixEnabled: boolean
  subscriptionActive: boolean
  cardConnected: boolean
  channels: number
  teamMembers: number
}

/** Mínimo de fotos para a vitrine não parecer vazia (capa + 2). */
export const MIN_GALLERY_PHOTOS = 3
/** Descrição curta demais não vende; 80 caracteres ≈ duas frases. */
export const MIN_DESCRIPTION_CHARS = 80

export function buildSetupSteps(i: SetupInput): SetupStep[] {
  const photos =
    i.gallery.filter(Boolean).length + (i.image && !i.gallery.includes(i.image) ? 1 : 0)
  return [
    {
      id: 'fotos',
      label: 'Fotos da pousada',
      hint: `Pelo menos ${MIN_GALLERY_PHOTOS} fotos, com a capa primeiro.`,
      href: '/dashboard/configuracoes',
      done: photos >= MIN_GALLERY_PHOTOS,
      optional: false,
    },
    {
      id: 'descricao',
      label: 'Descrição e horários',
      hint: 'Conte o que a pousada tem de especial e informe check-in e check-out.',
      href: '/dashboard/configuracoes',
      done:
        i.description.trim().length >= MIN_DESCRIPTION_CHARS &&
        Boolean(i.checkinTime) &&
        Boolean(i.checkoutTime),
      optional: false,
    },
    {
      id: 'politica',
      label: 'Política de cancelamento',
      hint: 'O hóspede lê antes de pagar. Evita discussão depois.',
      href: '/dashboard/configuracoes',
      done: i.cancellationPolicy.trim().length > 0,
      optional: false,
    },
    {
      id: 'contato',
      label: 'WhatsApp e e-mail de avisos',
      hint: 'Para onde vão os alertas de reserva e de comprovante.',
      href: '/dashboard/configuracoes',
      done: i.whatsapp.trim().length > 0 && i.notificationEmail.trim().length > 0,
      optional: false,
    },
    {
      id: 'acomodacoes',
      label: 'Acomodações com preço e foto',
      hint:
        i.sellableRooms === 0
          ? 'Cadastre ao menos uma acomodação ativa com diária.'
          : i.roomsWithoutPhotos > 0
            ? `${i.roomsWithoutPhotos === 1 ? '1 acomodação está' : `${i.roomsWithoutPhotos} acomodações estão`} sem foto.`
            : 'Tudo certo com as acomodações.',
      href: '/dashboard/acomodacoes',
      done: i.sellableRooms > 0 && i.roomsWithoutPhotos === 0,
      optional: false,
    },
    {
      id: 'pix',
      label: 'Chave Pix para receber',
      hint: 'O hóspede paga direto na conta da pousada.',
      href: '/dashboard/configuracoes',
      done: i.pixEnabled,
      optional: false,
    },
    {
      id: 'assinatura',
      label: 'Assinatura da Rota',
      hint: 'Ativa o sistema para a pousada depois do período de teste.',
      href: '/dashboard/configuracoes',
      done: i.subscriptionActive,
      optional: false,
    },
    {
      id: 'cartao',
      label: 'Cartão pelo Mercado Pago',
      hint: 'Opcional. Para quem quer parcelar.',
      href: '/dashboard/configuracoes',
      done: i.cardConnected,
      optional: true,
    },
    {
      id: 'canais',
      label: 'Airbnb e Booking',
      hint: 'Opcional. Bloqueia o quarto quando a reserva vem de lá.',
      href: '/dashboard/acomodacoes/canais',
      done: i.channels > 0,
      optional: true,
    },
    {
      id: 'equipe',
      label: 'Equipe',
      hint: 'Opcional. Convide recepção, governança ou financeiro.',
      href: '/dashboard/membros',
      done: i.teamMembers > 1,
      optional: true,
    },
  ]
}

export type SetupProgress = {
  steps: SetupStep[]
  requiredDone: number
  requiredTotal: number
  missingRequired: number
  complete: boolean
}

export function summarizeSetup(steps: SetupStep[]): SetupProgress {
  const required = steps.filter((s) => !s.optional)
  const requiredDone = required.filter((s) => s.done).length
  return {
    steps,
    requiredDone,
    requiredTotal: required.length,
    missingRequired: required.length - requiredDone,
    complete: requiredDone === required.length,
  }
}
