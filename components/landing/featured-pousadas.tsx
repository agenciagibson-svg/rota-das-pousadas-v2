import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Pousada } from '@/types'
import { Reveal } from '@/components/reveal'
import { PousadaCard } from '@/components/pousada/pousada-card'
import { buttonVariants } from '@/components/ui/button'
import { Section } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { cn } from '@/lib/utils'

/**
 * Logo depois do hero: as pousadas em cards comparáveis. No celular viram uma
 * faixa que rola de lado (o próximo card aparece pela metade, convidando a
 * deslizar); do tablet para cima, grade.
 */
export function FeaturedPousadas({ pousadas }: { pousadas: Pousada[] }) {
  return (
    <Section id="pousadas" className="pt-16 pb-12 lg:pt-24 lg:pb-16">
      <Reveal>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading eyebrow="Pousadas em destaque" title="Refúgios selecionados a dedo" />
          <Link
            href="/pousadas"
            className={cn(buttonVariants({ variant: 'outline', size: 'pill' }), 'w-fit')}
          >
            Ver todas as pousadas
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </Reveal>

      {/* Um Reveal só para a lista: no celular os cards fora da tela (à direita)
          não podem ficar invisíveis esperando o scroll vertical. */}
      <Reveal>
        <ul className="-mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
          {pousadas.map((p) => (
            <li key={p.slug} className="w-[82%] shrink-0 snap-start sm:w-auto">
              <PousadaCard pousada={p} />
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  )
}
