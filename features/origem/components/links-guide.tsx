import { Camera, ChevronDown, MapPin, MessageCircle, Star } from 'lucide-react'
import type { ComponentType } from 'react'
import { Card } from '@/components/ui/card'
import { LINKS_GUIDE_STEPS, LINKS_GUIDE_TIP, type GuideChannel } from '../guide'

const ICONS: Record<GuideChannel, ComponentType<{ className?: string }>> = {
  google: MapPin,
  instagram: Camera,
  whatsapp: MessageCircle,
}

/**
 * Passo a passo para colocar os links com a origem marcada. Fica logo abaixo
 * dos links, no Painel → Link da bio. O mesmo texto vai no e-mail de
 * boas-vindas (features/origem/guide.ts).
 */
export function LinksGuide() {
  return (
    <Card className="mt-5 p-5">
      <h2 className="text-foreground font-semibold">Como colocar os links</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Uns 10 minutos. Cada link leva para a página da sua pousada na Rota e mostra, em cada
        reserva, de onde o hóspede veio.
      </p>

      <div className="divide-border border-border mt-4 divide-y border-y">
        {LINKS_GUIDE_STEPS.map((step) => {
          const Icon = ICONS[step.id]
          return (
            <details key={step.id} className="group py-3">
              <summary className="text-foreground flex cursor-pointer list-none items-center gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span className="bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-4" />
                </span>
                <span className="flex-1">{step.title}</span>
                <ChevronDown
                  className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="pt-3 pl-11">
                <p className="text-muted-foreground text-xs">
                  Use o link <span className="text-foreground font-medium">“{step.linkName}”</span>{' '}
                  do quadro acima.
                </p>
                <ol className="text-foreground mt-2 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed">
                  {step.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
                {step.note && (
                  <p className="text-muted-foreground bg-muted mt-3 rounded-lg p-3 text-xs leading-relaxed">
                    {step.note}
                  </p>
                )}
              </div>
            </details>
          )
        })}
      </div>

      <p className="text-muted-foreground mt-4 flex items-start gap-2 text-sm leading-relaxed">
        <Star className="text-ipe mt-0.5 size-4 shrink-0" aria-hidden />
        <span>Dica: {LINKS_GUIDE_TIP}</span>
      </p>
    </Card>
  )
}
