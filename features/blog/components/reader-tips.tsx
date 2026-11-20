import Image from 'next/image'
import { Quote } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { BlogTip } from '../types'
import { TipForm } from './tip-form'

function formatTipDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

/** "Dicas de quem já foi": as aprovadas e o formulário para mandar a sua. */
export function ReaderTips({
  postSlug,
  place,
  tips,
}: {
  postSlug: string
  place: string
  tips: BlogTip[]
}) {
  return (
    <section aria-labelledby="dicas-leitores" className="mt-14">
      <h2 id="dicas-leitores" className="text-h2 text-foreground">
        Dicas de quem já foi
      </h2>
      {tips.length === 0 && (
        <p className="text-muted-foreground mt-2 text-base">
          Ainda não temos dicas de leitores para {place}. Seja o primeiro.
        </p>
      )}
      {tips.length > 0 && (
        <ul className="mt-6 grid gap-4">
          {tips.map((tip) => (
            <li key={tip.id}>
              <Card radius="3xl" className="flex flex-col gap-4 p-6 sm:flex-row">
                {tip.photoUrl && (
                  <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl sm:w-48">
                    <Image
                      src={tip.photoUrl}
                      alt={`Foto de ${tip.authorName} em ${place}`}
                      fill
                      sizes="(max-width: 640px) 100vw, 192px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <Quote className="text-accent size-6" aria-hidden />
                  <p className="text-foreground mt-2 text-base leading-relaxed whitespace-pre-line">
                    {tip.body}
                  </p>
                  <p className="text-muted-foreground mt-3 text-sm">
                    <span className="text-foreground font-semibold">{tip.authorName}</span>
                    {tip.authorCity && `, de ${tip.authorCity}`} · {formatTipDate(tip.createdAt)}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <TipForm postSlug={postSlug} place={place} />
    </section>
  )
}
