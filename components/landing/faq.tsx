import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Reveal } from '@/components/reveal'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'

const faqs = [
  {
    question: 'Como funciona o pagamento?',
    answer:
      'O pagamento é processado com segurança via Mercado Pago, direto com a pousada que você reservou. Aceitamos Pix e cartão de crédito.',
  },
  {
    question: 'Existe alguma taxa além da diária?',
    answer:
      'Sim: uma taxa de serviço de 8% é somada ao valor da diária e aparece detalhada antes de você confirmar a reserva — sem custos escondidos.',
  },
  {
    question: 'É seguro reservar pela Rota das Pousadas?',
    answer:
      'Toda pousada passa pela curadoria da nossa equipe antes de ser publicada, e cada reserva fica registrada com confirmação para você e para a pousada.',
  },
  {
    question: 'Posso cancelar ou alterar minha reserva?',
    answer:
      'Cada pousada define sua própria política de cancelamento, sempre informada antes da confirmação da reserva.',
  },
  {
    question: 'Como cadastro minha pousada na plataforma?',
    answer:
      'É gratuito: cadastre pelo painel do parceiro, nossa equipe revisa em pouco tempo e você não paga comissão sobre reservas.',
  },
  {
    question: 'Preciso criar conta pra reservar?',
    answer:
      'Sim — leva menos de um minuto e permite acompanhar suas reservas, favoritos e alertas de preço depois.',
  },
]

export function Faq() {
  return (
    <section className="bg-card py-16 lg:py-24">
      <Container className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-16">
        <Reveal>
          <SectionHeading
            eyebrow="Perguntas frequentes"
            title="Antes de reservar, tire suas dúvidas"
            className="lg:sticky lg:top-28"
          />
        </Reveal>

        <Reveal delay={0.1}>
          <Accordion type="single" className="border-border border-y">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.question} value={String(index)}>
                <AccordionTrigger className="py-5 text-left text-lg font-semibold">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 text-base leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Container>
    </section>
  )
}
