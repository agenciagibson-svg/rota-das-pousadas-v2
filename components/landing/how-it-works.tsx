import { Reveal } from '@/components/reveal'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'

const steps = [
  {
    number: '01',
    title: 'Descubra seu estilo',
    text: 'Filtre por clima, destino ou converse com o concierge pra receber sugestões sob medida.',
  },
  {
    number: '02',
    title: 'Compare datas e preços',
    text: 'Veja disponibilidade real, fotos e avaliações de outros viajantes antes de decidir.',
  },
  {
    number: '03',
    title: 'Reserve com segurança',
    text: 'Pagamento via Pix ou cartão, processado direto com a pousada, sem custo escondido.',
  },
  {
    number: '04',
    title: 'Viaje tranquilo',
    text: 'Acompanhe sua reserva, fale com a pousada e avalie a experiência depois da estadia.',
  },
]

/**
 * Passos numerados em linha, separados por fios — o número em peso leve faz
 * o papel que antes era de quatro ícones coloridos.
 */
export function HowItWorks() {
  return (
    <section className="bg-card py-16 lg:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-16">
          <Reveal>
            <SectionHeading
              eyebrow="Como funciona"
              title="Da inspiração à chave na mão"
              description="Quatro passos simples pra transformar vontade de viajar em reserva confirmada."
            />
          </Reveal>

          <ol className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.number} className="border-border border-t py-6">
                <Reveal delay={index * 0.08}>
                  <span className="text-muted-foreground text-xs font-semibold">Passo</span>
                  <span className="text-display-l text-muted-foreground mt-1 block font-light tabular-nums">
                    {step.number}
                  </span>
                  <h3 className="text-h3 text-foreground mt-5">{step.title}</h3>
                  <p className="text-muted-foreground mt-2 text-base leading-relaxed">
                    {step.text}
                  </p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  )
}
