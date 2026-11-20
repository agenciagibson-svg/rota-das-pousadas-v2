import type { Pousada } from '@/types'
import { formatPrice } from '@/lib/format'
import { BREAKFAST_TYPE, PET_TYPE, POOL_TYPE, hasStayType } from './amenities'

export type FaqItem = { question: string; answer: string }

function clip(text: string, max = 320): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/**
 * Perguntas frequentes da página da pousada. Só entra pergunta cuja resposta
 * a pousada cadastrou — nada de "não" por falta de dado: se a pousada não
 * marcou "aceita pet", a pergunta simplesmente não aparece.
 */
export function pousadaFaq(p: Pousada): FaqItem[] {
  const faq: FaqItem[] = []
  // "da Pousada do Sol" / "da pousada Chalés da Serra": o artigo concorda com "pousada".
  const n = /^pousada\b/i.test(p.name.trim()) ? p.name.trim() : `pousada ${p.name.trim()}`

  if (p.checkinTime || p.checkoutTime) {
    const parts = [
      p.checkinTime ? `o check-in é a partir das ${p.checkinTime}` : '',
      p.checkoutTime ? `o check-out é até as ${p.checkoutTime}` : '',
    ].filter(Boolean)
    const text = parts.join(' e ')
    faq.push({
      question: `Qual o horário de check-in e check-out da ${n}?`,
      answer: `Na ${n}, ${text}.`,
    })
  }

  if (p.pricePerNight > 0) {
    faq.push({
      question: `Quanto custa a diária na ${n}?`,
      answer: `A diária começa em ${formatPrice(p.pricePerNight)}. O valor muda conforme a acomodação e as datas, e o total aparece antes de você confirmar a reserva.`,
    })
  }

  if (hasStayType(p, PET_TYPE)) {
    faq.push({
      question: `A ${n} aceita pet?`,
      answer: `Sim, a ${n} recebe pets.${p.houseRules ? ' Confira as regras da casa antes de reservar.' : ''}`,
    })
  }

  if (hasStayType(p, BREAKFAST_TYPE)) {
    faq.push({
      question: `A ${n} serve café da manhã?`,
      answer: `Sim, a ${n} serve café da manhã.`,
    })
  }

  if (hasStayType(p, POOL_TYPE)) {
    faq.push({ question: `A ${n} tem piscina?`, answer: `Sim, a ${n} tem piscina.` })
  }

  if (p.tags.length) {
    faq.push({
      question: `O que a ${n} oferece?`,
      answer: `${p.tags.slice(0, 10).join(', ')}.`,
    })
  }

  if (p.cancellationPolicy?.trim()) {
    faq.push({
      question: `Qual a política de cancelamento da ${n}?`,
      answer: clip(p.cancellationPolicy),
    })
  }

  faq.push({
    question: `Onde fica a ${n}?`,
    answer: p.address?.trim()
      ? `Em ${p.city} (${p.state}), no endereço ${p.address.trim()}.`
      : `Em ${p.city} (${p.state}).`,
  })

  faq.push({
    question: `Como reservar a ${n}?`,
    answer:
      'Escolha as datas e a acomodação aqui na página e confirme a reserva. É direto com a pousada, sem intermediário, e o pagamento é por Pix ou cartão.',
  })

  return faq
}

/** FAQPage (schema.org) da pousada. */
export function pousadaFaqJsonLd(faq: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}
