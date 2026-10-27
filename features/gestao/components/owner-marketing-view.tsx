'use client'

import { useState, type ReactNode } from 'react'
import {
  CalendarDays,
  Check,
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
import { siteConfig } from '@/lib/seo'
import { formatBRL } from '@/lib/format'
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

  const link = settings?.slug ? `\n\nReserve direto: ${siteConfig.url}/${settings.slug}` : ''
  return `${name} em ${city}${state ? `, ${state}` : ''}: uma estadia acolhedora${highlight}. Reserve sua próxima pausa e viva dias de descanso com conforto e atendimento próximo.${link}`
}

function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copiado!' : 'Copiar texto'}
    </button>
  )
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
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0

  return [
    {
      title: 'Campanha de conversão',
      description:
        pending.length > 0
          ? `Há ${pending.length === 1 ? '1 reserva' : `${pending.length} reservas`} aguardando pagamento. Reforce urgência e prazo para reduzir perda.`
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
          ? `${formatBRL(finance.revenuePending)} ainda estão pendentes. Comunicação rápida pode proteger essa receita.`
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
  children,
}: {
  displayName: string
  pousadaName: string
  settings: OwnerPousadaSettings | null
  reservations: OwnerReservation[]
  reviews: OwnerReview[]
  finance: FinanceSummary
  /** Blocos extras vindos do servidor (ex.: cupons para quem reserva direto). */
  children?: ReactNode
}) {
  const campaigns = buildCampaigns({ reservations, reviews, finance, settings })
  const socialText = buildSocialText(settings)
  const profileChecks = [
    { label: 'Imagem principal cadastrada', done: Boolean(settings?.image) },
    {
      label: 'Descrição pública completa',
      done: Boolean(settings?.description && settings.description.length >= 80),
    },
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
          <div className="text-muted-foreground text-sm">Perfil completo</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">
            {completedChecks}/{profileChecks.length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Reservas ativas</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">
            {activeReservations(reservations).length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Avaliações</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">{reviews.length}</div>
        </Card>
      </div>

      {children && <div className="mt-5">{children}</div>}

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl">
              <Megaphone className="size-5" />
            </span>
            <div>
              <h2 className="text-foreground font-semibold">Campanhas sugeridas</h2>
              <p className="text-muted-foreground text-sm">
                Ideias práticas calculadas a partir da sua operação atual.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 xl:grid-cols-2">
            {campaigns.map((campaign) => {
              const Icon = campaign.icon
              return (
                <div key={campaign.title} className="border-border rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                      <Icon className="size-4" />
                    </span>
                    <Badge variant="primarySoft" size="sm">
                      {campaign.badge}
                    </Badge>
                  </div>
                  <h3 className="text-foreground mt-3 font-semibold">{campaign.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {campaign.description}
                  </p>
                  <p className="text-foreground mt-3 text-sm font-medium">{campaign.action}</p>
                </div>
              )
            })}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-6">
            <div className="text-foreground flex items-center gap-2 font-semibold">
              <Share2 className="text-primary size-4" />
              Texto pronto
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Use como base para Instagram, WhatsApp ou anúncio local.
            </p>
            <div className="bg-secondary text-foreground mt-4 rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-line">
              {socialText}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyTextButton text={socialText} />
              <a
                href={`https://wa.me/?text=${encodeURIComponent(socialText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-success text-success-foreground hover:bg-success/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
              >
                <Share2 className="size-3.5" />
                Compartilhar no WhatsApp
              </a>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-foreground flex items-center gap-2 font-semibold">
              <ImageIcon className="text-primary size-4" />
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
