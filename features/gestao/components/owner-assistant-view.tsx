'use client'

import {
  AlertCircle,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  DollarSign,
  MessageSquareText,
  Sparkles,
  Star,
} from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { FinanceSummary } from '@/features/financeiro/types'
import type { OwnerPousadaSettings, OwnerReservation, OwnerReview } from '../types'

type Insight = {
  title: string
  description: string
  action: string
  tone: 'alert' | 'primary' | 'neutral'
  icon: typeof Bot
}

function isActiveReservation(status: OwnerReservation['status']) {
  return !['cancelled', 'no_show'].includes(status)
}

function daysUntil(date: string) {
  const today = new Date()
  const target = new Date(`${date}T00:00:00`)
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function buildInsights({
  reservations,
  reviews,
  finance,
  settings,
}: {
  reservations: OwnerReservation[]
  reviews: OwnerReview[]
  finance: FinanceSummary
  settings: OwnerPousadaSettings | null
}): Insight[] {
  const pendingPayments = reservations.filter((r) => r.status === 'pending')
  const nextCheckins = reservations
    .filter((r) => isActiveReservation(r.status) && daysUntil(r.checkin) >= 0)
    .sort((a, b) => a.checkin.localeCompare(b.checkin))
    .slice(0, 3)
  const unansweredReviews = reviews.filter((review) => !review.response)
  const missingSettings = [
    !settings?.contactPhone && 'telefone',
    !settings?.notificationEmail && 'e-mail de notificações',
    !settings?.houseRules && 'regras da casa',
    !settings?.cancellationPolicy && 'política de cancelamento',
  ].filter(Boolean)

  const insights: Insight[] = []

  if (pendingPayments.length > 0) {
    insights.push({
      title: `${pendingPayments.length} reserva(s) aguardando pagamento`,
      description: 'Acompanhe o prazo dessas reservas para evitar bloqueio de datas sem confirmação.',
      action: 'Priorize contato com o hóspede antes do vencimento.',
      tone: 'alert',
      icon: Clock3,
    })
  }

  if (nextCheckins.length > 0) {
    const first = nextCheckins[0]
    insights.push({
      title: `Próximo check-in: ${first.guestName}`,
      description: `${first.roomName}, ${first.guests} hóspede(s), reserva ${first.code}.`,
      action: 'Envie instruções de chegada e confirme horário previsto.',
      tone: 'primary',
      icon: CalendarCheck,
    })
  }

  if (unansweredReviews.length > 0) {
    insights.push({
      title: `${unansweredReviews.length} avaliação(ões) sem resposta`,
      description: 'Responder avaliações melhora confiança e mostra cuidado no atendimento.',
      action: 'Abra Avaliações e responda os comentários pendentes.',
      tone: 'primary',
      icon: Star,
    })
  }

  if (finance.revenuePending > 0) {
    insights.push({
      title: `R$ ${finance.revenuePending} a receber`,
      description: 'Há receita pendente ligada a reservas ainda não confirmadas financeiramente.',
      action: 'Mantenha o financeiro alinhado antes de confirmar estadias longas.',
      tone: 'neutral',
      icon: DollarSign,
    })
  }

  if (missingSettings.length > 0) {
    insights.push({
      title: 'Configurações incompletas',
      description: `Faltam: ${missingSettings.join(', ')}.`,
      action: 'Complete esses dados para reduzir dúvidas antes da reserva.',
      tone: 'alert',
      icon: AlertCircle,
    })
  }

  if (insights.length === 0) {
    insights.push({
      title: 'Operação em dia',
      description: 'Não encontrei pendências urgentes com os dados atuais.',
      action: 'Continue acompanhando reservas e avaliações diariamente.',
      tone: 'primary',
      icon: CheckCircle2,
    })
  }

  return insights
}

function suggestedMessage(settings: OwnerPousadaSettings | null) {
  const checkin = settings?.checkinTime || '14:00'
  const checkout = settings?.checkoutTime || '12:00'
  return `Olá! Sua reserva está registrada. Nosso check-in começa às ${checkin} e o check-out é até ${checkout}. Qualquer dúvida antes da chegada, estamos à disposição.`
}

export function OwnerAssistantView({
  displayName,
  pousadaName,
  reservations,
  reviews,
  finance,
  settings,
}: {
  displayName: string
  pousadaName: string
  reservations: OwnerReservation[]
  reviews: OwnerReview[]
  finance: FinanceSummary
  settings: OwnerPousadaSettings | null
}) {
  const insights = buildInsights({ reservations, reviews, finance, settings })
  const activeReservations = reservations.filter((reservation) => isActiveReservation(reservation.status))
  const occupancyNights = activeReservations.reduce((sum, reservation) => sum + reservation.nights, 0)

  return (
    <DashboardShell
      nav={ownerDashboardNav('assistente')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Assistente IA"
      subtitle="Sugestões práticas com base nas reservas, avaliações e financeiro."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Reservas ativas</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{activeReservations.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Noites ocupadas</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{occupancyNights}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Saldo financeiro</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">R$ {finance.balance}</div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">Prioridades do dia</h2>
              <p className="text-sm text-muted-foreground">
                Recomendações calculadas com os dados atuais da pousada.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {insights.map((insight) => {
              const Icon = insight.icon
              return (
                <div key={insight.title} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <span
                        className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
                          insight.tone === 'alert'
                            ? 'bg-destructive/10 text-destructive'
                            : insight.tone === 'primary'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <h3 className="font-semibold text-foreground">{insight.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{insight.description}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{insight.action}</p>
                      </div>
                    </div>
                    <Badge
                      variant={insight.tone === 'alert' ? 'destructiveSoft' : 'primarySoft'}
                      size="sm"
                    >
                      {insight.tone === 'alert' ? 'Atenção' : 'Sugestão'}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <MessageSquareText className="size-4 text-primary" />
              Resposta rápida
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Modelo para enviar ao hóspede após uma reserva ou dúvida.
            </p>
            <div className="mt-4 rounded-2xl bg-secondary p-4 text-sm leading-relaxed text-foreground">
              {suggestedMessage(settings)}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Bot className="size-4 text-primary" />
              Próxima etapa
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Quando formos integrar IA real, esta área poderá gerar respostas, campanhas e ajustes
              de diária automaticamente. Por enquanto, ela usa regras seguras com os dados do sistema.
            </p>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
