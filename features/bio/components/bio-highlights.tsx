import Link from 'next/link'
import { ArrowRight, Quote, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/** Avaliação pública (anônima: sem nome do hóspede — ver reviews.repository). */
type BioReview = { id: string; rating: number; text: string; createdAt: string }

function monthYear(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

/**
 * Destaques da pousada (as etiquetas do cadastro) e até 3 avaliações de
 * hóspedes reais, com o link para a página completa.
 */
export function BioHighlights({
  slug,
  tags,
  reviews,
}: {
  slug: string
  tags: string[]
  reviews: BioReview[]
}) {
  return (
    <section aria-labelledby="bio-destaques" className="flex flex-col gap-4">
      {tags.length > 0 && (
        <div>
          <h2 id="bio-destaques" className="text-h3 text-foreground">
            O que você encontra aqui
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {tags.slice(0, 8).map((tag) => (
              <li key={tag}>
                <Badge variant="outline" size="lg">
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reviews.length > 0 && (
        <div>
          <h2 className="text-h3 text-foreground">Quem já ficou</h2>
          <ul className="mt-3 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
            {reviews.slice(0, 3).map((review) => (
              <li
                key={review.id}
                className="bg-card flex w-4/5 shrink-0 snap-start flex-col gap-2 rounded-2xl p-4"
              >
                <span className="flex items-center gap-1" aria-label={`Nota ${review.rating} de 5`}>
                  {Array.from({ length: 5 }, (_, s) => (
                    <Star
                      key={s}
                      aria-hidden
                      className={
                        s < Math.round(review.rating)
                          ? 'fill-accent text-accent size-4'
                          : 'text-muted-foreground size-4'
                      }
                    />
                  ))}
                </span>
                <p className="text-foreground line-clamp-5 text-sm leading-relaxed">
                  <Quote className="text-accent mr-1 inline size-4 align-text-top" aria-hidden />
                  {review.text}
                </p>
                <span className="text-muted-foreground mt-auto text-xs">
                  <strong className="text-foreground">Hóspede que ficou aqui</strong> ·{' '}
                  {monthYear(review.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href={`/pousada/${slug}?origem=link_bio`}
        className="text-foreground inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
      >
        Ver todas as fotos, comodidades e regras
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  )
}
