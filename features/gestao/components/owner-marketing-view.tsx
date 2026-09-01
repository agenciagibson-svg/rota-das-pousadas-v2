'use client'

import {
  CalendarDays,
  CheckCircle2,
  Copy,
  Image as ImageIcon,
  Megaphone,
  Share2,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import type { FinanceSummary } from '@/features/financeiro/types'
import type { OwnerPousadaSettings, OwnerReservation, OwnerReview } from '../types'

function activeReservations(reservations: OwnerReservation[]) {
  return reservations.filter(
    (reservation) => !['cancelled', 'no_show'].includes(reservation.status),
  )
}

function buildSocialText(settings: OwnerPousadaSettings | null) {
  const name = settings?.name ?? 'Nossa pousada'
  const city = settings?.city ?? 'um destino especial'
  const state = settings?.state ?? ''
  const tags = settings?.tags?.slice(0, 3).join(', ')
  const highlight = tags ? ` com ${tags}` : ''

  return `${name} em ${city}${state ? `, ${state}` : ''}: uma estadia acolhedora${highlight}. Reserve sua próxima pausa e viva dias de descanso com conforto e atendimento próximo.`
}

function buildCampaigns({
  reservations,
  reviews,
  finance,
  settings,
}: {
  reservations: OwnerReservation[]
  reviews: OwnerReview[]
  finance: FinanceSummary
  settings: OwnerPousadaSettings | null
}) {
  const active = activeReservations(reservations)
  const pending = reservations.filter((reservation) => reservation.status === 'pending')
  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0

  return [
    {
      title: 'Campanha de conversão',
      description:
        pending.length > 0
          ? `Há ${pending.length} reserva(s) aguardando pagamento. Reforce urgência e prazo para reduzir perda.`
          : 'Use chamada direta para transformar visitas em novas reservas.',
      action: 'Mensagem curta para WhatsApp e redes sociais.',
      icon: Target,
      badge: 'Prioridade',
    },
    {
      title: 'Pacote de baixa ocupação',
      description:
        active.length < 3
          ? 'A agenda ainda tem espaço. Crie um pacote de duas noites com benefício simples.'
          : 'Aproveite a ocupação atual para divulgar últimas datas disponíveis.',
      action: 'Oferta sugerida: 2 noites com café especial ou late checkout.',
      icon: CalendarDays,
      badge: 'Oportunidade',
    },
    {
      title: 'Prova social',
      description:
        averageRating >= 4.5
          ? `Use a nota média ${averageRating.toFixed(1)} nas divulgações.`
          : reviews.length > 0
            ? 'Responda avaliações e destaque comentários positivos.'
            : 'Quando chegarem avaliações, use os melhores comentários nas campanhas.',
      action: 'Inclua nota, comentário real e foto da acomodação.',
      icon: Star,
      badge: 'Confiança',
    },
    {
      title: 'Receita pendente',
      description:
        finance.revenuePending > 0
          ? `R$ ${finance.revenuePending} ainda estão pendentes. Comunicação rápida pode proteger essa receita.`
          : 'Sem receita pendente no momento. Foque em novas reservas.',
      action: 'Crie lembrete amigável para finalizar reserva.',
      icon: TrendingUp,
      badge: 'Financeiro',
    },
  ]
}

export function OwnerMarketingView({
  displayName,
  pousadaName,
  settings,
  reservations,
  reviews,
  finance,
}: {
  displayName: string
  pousadaName: string
  settings: OwnerPousadaSettings | null
  reservations: OwnerReservation[]
  reviews: OwnerReview[]
  finance: FinanceSummary
}) {
  const campaigns = buildCampaigns({ reservations, reviews, finance, settings })
  const socialText = buildSocialText(settings)
  const profileChecks = [
    { label: 'Imagem principal cadastrada', done: Boolean(settings?.image) },
    { label: 'Descrição pública completa', done: Boolean(settings?.description && settings.description.length >= 80) },
    { label: 'Tags de destaque', done: Boolean(settings?.tags?.length) },
    { label: 'Telefone de contato', done: Boolean(settings?.contactPhone) },
    { label: 'Política de cancelamento', done: Boolean(settings?.cancellationPolicy) },
  ]
  const completedChecks = profileChecks.filter((check) => check.done).length

  return (
    <DashboardShell
      nav={ownerDashboardNav('marketing')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Marketing"
      subtitle="Promova sua pousada e acompanhe oportunidades."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Perfil completo</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">
            {completedChecks}/{profileChecks.length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Reservas ativas</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">
            {activeReservations(reservations).length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Avaliações</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{reviews.length}</div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Megaphone className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">Campanhas sugeridas</h2>
              <p className="text-sm text-muted-foreground">
                Ideias práticas calculadas a partir da sua operação atual.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 xl:grid-cols-2">
            {campaigns.map((campaign) => {
              const Icon = campaign.icon
              return (
                <div key={campaign.title} className="rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <Badge variant="primarySoft" size="sm">
                      {campaign.badge}
                    </Badge>
                  </div>
                  <h3 className="mt-3 font-semibold text-foreground">{campaign.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {campaign.description}
                  </p>
                  <p className="mt-3 text-sm font-medium text-foreground">{campaign.action}</p>
                </div>
              )
            })}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Share2 className="size-4 text-primary" />
              Texto pronto
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Use como base para Instagram, WhatsApp ou anúncio local.
            </p>
            <div className="mt-4 rounded-2xl bg-secondary p-4 text-sm leading-relaxed text-foreground">
              {socialText}
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <Copy className="size-3.5" />
              Pronto para copiar
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <ImageIcon className="size-4 text-primary" />
              Checklist do perfil
            </div>
            <div className="mt-4 space-y-3">
              {profileChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-2 text-sm">
                  <CheckCircle2
                    className={`size-4 ${check.done ? 'text-primary' : 'text-muted-foreground/40'}`}
                  />
                  <span className={check.done ? 'text-foreground' : 'text-muted-foreground'}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/dashboard/configuracoes"
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-5' })}
            >
              <Sparkles className="size-3.5" />
              Completar perfil
            </Link>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
