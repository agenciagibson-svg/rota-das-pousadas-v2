/**
 * Passo a passo para a pousada colocar os links com a origem marcada (0106)
 * no Google, no Instagram e no WhatsApp. Um texto só para o painel
 * (Painel → Link da bio) e para o e-mail de boas-vindas (0107).
 */

export type GuideChannel = 'google' | 'instagram' | 'whatsapp'

export type GuideStep = {
  id: GuideChannel
  title: string
  /** Nome do link no quadro "Links com a origem marcada". */
  linkName: string
  items: string[]
  note?: string
}

export const LINKS_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'google',
    title: 'Perfil da pousada no Google',
    linkName: 'Perfil da pousada no Google',
    items: [
      'Entre na conta Google que administra o perfil da pousada.',
      'Pesquise o nome da pousada no Google e clique em “Editar perfil”.',
      'Abra “Contato” e, no campo “Site”, cole o link.',
      'Salve. A mudança pode levar alguns dias para aparecer.',
    ],
    note: 'Já usa um site próprio nesse campo? Mantenha o seu site e coloque o link da Rota no botão “Reservar” dele. Perfil ainda não verificado no Google? Vale verificar: sem isso, qualquer pessoa pode sugerir mudanças nas informações da pousada.',
  },
  {
    id: 'instagram',
    title: 'Bio do Instagram',
    linkName: 'Bio do Instagram',
    items: [
      'No app do Instagram, toque em “Editar perfil” → “Links” → “Adicionar link externo”.',
      'Cole o link.',
      'No título, use algo como “Reserve aqui” ou “Datas e preços”.',
      'Avise nos stories que agora dá para reservar direto pelo link da bio.',
    ],
  },
  {
    id: 'whatsapp',
    title: 'Mensagens no WhatsApp',
    linkName: 'Mensagens no WhatsApp',
    items: [
      'Quando alguém perguntar preço ou disponibilidade, envie o link.',
      'A pessoa vê as acomodações, as datas livres e o valor, e já faz a reserva.',
      'No WhatsApp Business, salve o link numa resposta rápida para não copiar toda vez.',
    ],
  },
]

export const LINKS_GUIDE_TIP =
  'Depois de cada estadia, peça uma avaliação ao hóspede. As estrelas aparecem na sua página e ajudam a pousada a aparecer mais no Google.'

export type TrackedLinks = { googleProfile: string; instagramBio: string; whatsapp: string }

export function linkFor(links: TrackedLinks, channel: GuideChannel): string {
  return channel === 'google'
    ? links.googleProfile
    : channel === 'instagram'
      ? links.instagramBio
      : links.whatsapp
}

/** Texto do guia para o WhatsApp (o admin abre o wa.me com ele preenchido). */
export function guideWhatsappText(p: {
  pousadaName: string
  links: TrackedLinks
  panelUrl: string
}) {
  const lines = [
    `Oi! Aqui é da Rota das Pousadas. A ${p.pousadaName} já está no ar 🎉`,
    '',
    'Para receber mais reservas diretas, coloque estes links (uns 10 minutos):',
    '',
  ]
  for (const step of LINKS_GUIDE_STEPS) {
    lines.push(`*${step.title}*`, linkFor(p.links, step.id))
    if (step.id === 'google') {
      lines.push('Google → pesquise a pousada → Editar perfil → Contato → Site → cole o link.')
    } else if (step.id === 'instagram') {
      lines.push('Instagram → Editar perfil → Links → Adicionar link externo → cole o link.')
    } else {
      lines.push('Mande este link quando perguntarem preço ou disponibilidade.')
    }
    lines.push('')
  }
  lines.push(
    `Os links e o passo a passo completo também ficam no seu painel: ${p.panelUrl}`,
    '',
    'Qualquer dúvida, é só chamar aqui.',
  )
  return lines.join('\n')
}

/** Só dígitos, com DDI 55: o formato do wa.me. `null` se não parece telefone. */
export function whatsappNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
}
