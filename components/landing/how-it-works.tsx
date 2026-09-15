import { CalendarDays, Luggage, Search, ShieldCheck } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { cn } from '@/lib/utils'

type Tone = 'primary' | 'ocean' | 'gold' | 'accent'

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  ocean: 'bg-ocean/10 text-ocean',
  gold: 'bg-gold/10 text-gold',
  accent: 'bg-accent/10 text-accent',
}

const steps = [
  {
    number: '01',
    icon: Search,
    tone: 'primary' as Tone,
    title: 'Descubra seu estilo',
    text: 'Filtre por clima, destino ou converse com o concierge pra receber sugestões sob medida.',
  },
  {
    number: '02',
    icon: CalendarDays,
    tone: 'ocean' as Tone,
    title: 'Compare datas e preços',
    text: 'Veja disponibilidade real, fotos e avaliações de outros viajantes antes de decidir.',
  },
  {
    number: '03',
    icon: ShieldCheck,
    tone: 'gold' as Tone,
    title: 'Reserve com segurança',
    text: 'Pagamento via Pix ou cartão, processado direto com a pousada, sem custo escondido.',
  },
  {
    number: '04',
    icon: Luggage,
    tone: 'accent' as Tone,
    title: 'Viaje tranquilo',
    text: 'Acompanhe sua reserva, fale com a pousada e avalie a experiência depois da estadia.',
  },
]

export function HowItWorks() {
  return (
    <section className="bg-secondary/40 py-20 lg:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Como funciona"
            title="Da inspiração à chave na mão"
            description="Quatro passos simples pra transformar vontade de viajar em reserva confirmada."
          />
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Reveal key={step.number} delay={index * 0.08}>
              <div className="border-border bg-card h-full rounded-3xl border p-6">
                <span
                  className={cn(
                    'flex size-12 items-center justify-center rounded-2xl',
                    toneClasses[step.tone],
                  )}
                >
                  <step.icon className="size-6" />
                </span>
                <span className="text-muted-foreground mt-5 block text-xs font-semibold tracking-[0.2em] uppercase">
                  Passo {step.number}
                </span>
                <h3 className="text-foreground mt-1 font-serif text-xl font-semibold">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
