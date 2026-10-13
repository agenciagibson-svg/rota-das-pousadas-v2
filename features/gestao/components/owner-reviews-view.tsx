'use client'

import { CalendarCheck, Mail, MessageSquareReply, Star } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { OwnerReview } from '../types'
import { ReviewResponseForm } from './review-response-form'

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

function fmtStay(checkin: string | null, checkout: string | null): string {
  if (!checkin || !checkout) return 'Reserva sem período'
  const [iy, im, id] = checkin.split('-')
  const [oy, om, od] = checkout.split('-')
  return `${id}/${im}/${iy} - ${od}/${om}/${oy}`
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="text-gold inline-flex">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`size-4 ${index < rating ? 'fill-gold' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  )
}

export function OwnerReviewsView({
  displayName,
  pousadaName,
  reviews,
  canRespond,
}: {
  displayName: string
  pousadaName: string
  reviews: OwnerReview[]
  /** `review:respond` do papel ativo — recepção/financeiro/governança não respondem (RLS já recusava a escrita; isso só evita o erro cru do Postgres). */
  canRespond: boolean
}) {
  const average =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0
  const pendingResponses = reviews.filter((review) => !review.response).length

  return (
    <DashboardShell
      nav={ownerDashboardNav('avaliacoes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Avaliações"
      subtitle="Acompanhe notas, comentários e respostas aos hóspedes."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Nota média</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-foreground text-3xl font-semibold">
              {reviews.length > 0 ? average.toFixed(1).replace('.', ',') : '—'}
            </span>
            {reviews.length > 0 && <RatingStars rating={Math.round(average)} />}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Avaliações</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">{reviews.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Sem resposta</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">{pendingResponses}</div>
        </Card>
      </div>

      <Card className="mt-5 p-6">
        <h2 className="text-foreground font-semibold">Comentários dos hóspedes</h2>
        <p className="text-muted-foreground text-sm">
          Responda avaliações recebidas após estadias concluídas.
        </p>

        {reviews.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon={Star}
            title="Nenhuma avaliação ainda"
            description="Quando um hóspede avaliar uma estadia, o comentário aparecerá aqui."
          />
        ) : (
          <div className="mt-5 space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-border rounded-2xl border p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-foreground font-display text-lg font-medium">
                        {review.guestName}
                      </h3>
                      <RatingStars rating={review.rating} />
                    </div>
                    <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="size-3.5" />
                        {review.guestEmail}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarCheck className="size-3.5" />
                        {fmtStay(review.checkin, review.checkout)}
                      </span>
                      <span>{review.bookingCode}</span>
                      <span>{fmtDate(review.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <p className="text-foreground mt-4 text-sm leading-relaxed">{review.text}</p>

                {review.response && (
                  <div className="bg-secondary text-muted-foreground mt-4 rounded-2xl p-4 text-sm">
                    <div className="text-foreground mb-1 inline-flex items-center gap-1.5 font-semibold">
                      <MessageSquareReply className="text-primary size-4" />
                      Sua resposta
                    </div>
                    <p>{review.response}</p>
                  </div>
                )}

                {canRespond ? (
                  <div className="mt-4">
                    <ReviewResponseForm reviewId={review.id} initialResponse={review.response} />
                  </div>
                ) : (
                  !review.response && (
                    <p className="text-muted-foreground mt-4 text-xs">
                      Seu papel não pode responder avaliações.
                    </p>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </DashboardShell>
  )
}
