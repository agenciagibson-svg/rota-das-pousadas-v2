'use client'

import {
  LayoutDashboard,
  CalendarCheck,
  Star,
  TrendingUp,
  DollarSign,
  Users,
  ArrowUpRight,
  Sparkles,
  LogIn,
  LogOut,
} from 'lucide-react'
import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { AreaChart, BarChart, Donut } from '@/components/dashboard/charts'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { Building2 } from 'lucide-react'
import { OwnerReservationsTable } from '@/features/gestao/components/owner-reservations-table'
import type { OwnerReservation } from '@/features/gestao/types'
import type {
  MonthlyRevenuePoint,
  OccupancySnapshot,
  ReviewSummary,
  WeeklyDailies,
} from '@/features/dashboard/metrics'

/**
 * View (client) do painel do proprietário. Recebe apenas dados serializáveis do
 * Server Component pai — ícones e interatividade vivem aqui, respeitando a
 * fronteira server/client do App Router.
 *
 * ⚠️ Nenhum número desta tela pode ser escrito à mão. Toda métrica vem
 * calculada de `features/dashboard/metrics.ts` a partir das reservas, quartos e
 * avaliações reais da pousada. Quando um dado não existe, a tela mostra estado
 * vazio — nunca um valor de exemplo, que o cliente lê como se fosse a casa dele.
 */
export function OwnerDashboardView({
  displayName,
  pousadaName,
  pousadaStatus,
  reservations,
  occupancy,
  revenueSeries,
  week,
  reviews,
  arrivalsToday,
  departuresToday,
}: {
  displayName: string
  pousadaName: string | null
  pousadaStatus: string | null
  reservations: OwnerReservation[]
  /** `null` quando o papel do usuário não pode ler acomodações — sem quartos não há taxa de ocupação. */
  occupancy: OccupancySnapshot | null
  revenueSeries: MonthlyRevenuePoint[]
  week: WeeklyDailies
  reviews: ReviewSummary
  arrivalsToday: OwnerReservation[]
  departuresToday: OwnerReservation[]
}) {
  const firstName = displayName.split(/[\s@]/)[0]
  const activeReservations = reservations.filter(
    (reservation) => !['cancelled', 'no_show'].includes(reservation.status),
  )
  const pendingReservations = reservations.filter(
    (reservation) => reservation.status === 'pending',
  )
  const confirmedReservations = reservations.filter(
    (reservation) =>
      reservation.status === 'confirmed' ||
      reservation.status === 'checked_in' ||
      reservation.status === 'checked_out',
  )
  const activeRevenue = activeReservations.reduce((sum, reservation) => sum + reservation.total, 0)
  const activeGuests = activeReservations.reduce((sum, reservation) => sum + reservation.guests, 0)
  /** Diárias que ainda dá para vender nos próximos 7 dias — capacidade menos o que já está ocupado. */
  const freeNightsAhead = occupancy
    ? Math.max(0, occupancy.availableNights - occupancy.occupiedNights)
    : 0
  const stats = [
    {
      label: 'Receita ativa',
      value: `R$ ${activeRevenue}`,
      delta: `${confirmedReservations.length} confirmadas`,
      up: true,
      icon: DollarSign,
    },
    {
      label: 'Reservas ativas',
      value: String(activeReservations.length),
      delta: `${pendingReservations.length} pendentes`,
      up: pendingReservations.length === 0,
      icon: CalendarCheck,
    },
    {
      label: 'Pendentes',
      value: String(pendingReservations.length),
      delta: 'Aguardando pagamento',
      up: pendingReservations.length === 0,
      icon: TrendingUp,
    },
    {
      label: 'Hóspedes previstos',
      value: String(activeGuests),
      delta: `${activeReservations.length} reservas`,
      up: true,
      icon: Users,
    },
  ]

  // Sem pousada gerida → onboarding.
  if (!pousadaName) {
    return (
      <DashboardShell
        nav={[{ label: 'Visão geral', icon: LayoutDashboard, href: '/dashboard', active: true }]}
        brandLabel="Rota das Pousadas"
        brandSub="Painel do proprietário"
        title={`Bem-vindo, ${firstName}`}
        subtitle="Cadastre sua pousada para começar a gerenciar reservas."
        user={{ name: displayName, role: 'Proprietário' }}
      >
        <EmptyState
          className="mt-4"
          icon={Building2}
          title="Você ainda não tem uma pousada"
          description="Cadastre sua pousada para receber reservas e acessar o sistema de gestão. Nossa curadoria analisa e publica em seguida."
          action={
            <Link href="/anunciar" className={buttonVariants()}>
              Cadastrar minha pousada
            </Link>
          }
        />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      nav={ownerDashboardNav('overview')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title={`Bom dia, ${firstName}`}
      subtitle="Aqui está o resumo da sua pousada."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      {pousadaStatus && pousadaStatus !== 'publicada' && (
        <div
          className={`mb-5 rounded-2xl border p-4 text-sm ${
            pousadaStatus === 'reprovada'
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'border-gold/40 bg-gold/10 text-[color:#8a6d0f]'
          }`}
        >
          {pousadaStatus === 'reprovada'
            ? 'Sua pousada foi reprovada na curadoria. Revise as informações e fale com o suporte.'
            : 'Sua pousada está em análise pela nossa curadoria. Você já pode preparar tudo; ela ficará visível no site após a aprovação.'}
        </div>
      )}
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} delta={s.delta} up={s.up} icon={s.icon} />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Revenue */}
        <div className="rounded-2xl border border-border bg-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Receita por mês</h2>
              <p className="text-sm text-muted-foreground">
                Últimos 12 meses, pelo mês do check-in
              </p>
            </div>
            <span className="text-sm font-semibold text-primary">R$ {activeRevenue} ativo</span>
          </div>
          <div className="mt-6 h-48">
            {revenueSeries.some((point) => point.value > 0) ? (
              <AreaChart data={revenueSeries.map((point) => point.value)} />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                Ainda sem reservas nos últimos 12 meses. O gráfico aparece assim que a
                primeira estadia for lançada.
              </div>
            )}
          </div>
        </div>

        {/* Occupancy */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6">
          <h2 className="self-start font-semibold text-foreground">Ocupação</h2>
          {occupancy === null ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              A ocupação não está disponível para o seu perfil de acesso.
            </p>
          ) : occupancy.totalRooms === 0 ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>Nenhuma acomodação disponível para venda.</p>
              <Link href="/dashboard/acomodacoes" className="mt-2 inline-block font-semibold text-primary hover:underline">
                Cadastrar acomodações
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-4">
                <Donut value={occupancy.rate} />
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {occupancy.roomsOccupiedToday} de {occupancy.totalRooms}{' '}
                {occupancy.totalRooms === 1 ? 'acomodação ocupada' : 'acomodações ocupadas'} hoje
                <br />
                <span className="text-xs">
                  {occupancy.occupiedNights} de {occupancy.availableNights} diárias nos próximos 7 dias
                </span>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Reservations table */}
        <div className="rounded-2xl border border-border bg-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Próximas reservas</h2>
            <Link
              href="/dashboard/reservas"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              Ver agenda <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <OwnerReservationsTable reservations={reservations.slice(0, 5)} />
          </div>
        </div>

        {/* Weekly bookings */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Reservas na semana</h2>
          <p className="text-sm text-muted-foreground">
            {week.total === 1 ? '1 diária' : `${week.total} diárias`} de segunda a domingo
          </p>
          <div className="mt-6 h-40">
            <BarChart data={week.data} labels={week.labels} color="var(--ocean)" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Movimento de hoje — substitui a antiga lista de mensagens de exemplo. */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Movimento de hoje</h2>
            <Link
              href="/dashboard/reservas"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              Ver todas <ArrowUpRight className="size-4" />
            </Link>
          </div>
          {arrivalsToday.length === 0 && departuresToday.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhuma chegada ou saída prevista para hoje.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {arrivalsToday.map((reservation) => (
                <div key={`in-${reservation.id}`} className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <LogIn className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{reservation.guestName}</span>
                      <span className="shrink-0 text-xs font-semibold text-primary">Chegada</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {reservation.roomName} · {reservation.nights}{' '}
                      {reservation.nights === 1 ? 'noite' : 'noites'}
                    </p>
                  </div>
                </div>
              ))}
              {departuresToday.map((reservation) => (
                <div key={`out-${reservation.id}`} className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <LogOut className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{reservation.guestName}</span>
                      <span className="shrink-0 text-xs font-semibold text-accent">Saída</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {reservation.roomName}
                      {reservation.balanceDue > 0 ? ` · saldo de R$ ${reservation.balanceDue}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reviews summary */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Avaliações</h2>
          {reviews.total === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Sua pousada ainda não recebeu avaliações. Elas aparecem aqui depois da primeira
              estadia concluída.
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-4">
                <div className="text-4xl font-semibold text-foreground">
                  {reviews.average.toFixed(1)}
                </div>
                <div>
                  <div className="flex text-gold">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-4 ${i < Math.round(reviews.average) ? 'fill-gold' : 'opacity-30'}`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {reviews.total === 1 ? '1 avaliação' : `${reviews.total} avaliações`}
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {reviews.distribution.map(({ rating, count, percent }) => (
                  <div key={rating} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-muted-foreground">{rating}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="w-8 text-right text-muted-foreground" title={`${count} avaliação(ões)`}>
                      {percent}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/*
          Card de oportunidade. Antes exibia uma recomendação inventada ("a IA
          detectou alta procura") com um botão sem ação. O texto agora sai da
          ocupação calculada; enquanto não houver um provedor de LLM ligado, a
          tela não afirma que alguma IA analisou coisa alguma.
        */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-stone-deep p-6 text-linen">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-linen/10 px-3 py-1 text-xs font-semibold text-linen">
              <Sparkles className="size-3.5 text-gold" />
              Próximos 7 dias
            </span>
            {occupancy === null || occupancy.availableNights === 0 ? (
              <>
                <h2 className="mt-4 font-serif text-xl font-semibold">Divulgue sua pousada</h2>
                <p className="mt-2 text-sm leading-relaxed text-linen/70">
                  Materiais prontos para publicar nas suas redes e responder a quem pede orçamento.
                </p>
              </>
            ) : freeNightsAhead > 0 ? (
              <>
                <h2 className="mt-4 font-serif text-xl font-semibold">
                  {freeNightsAhead === 1 ? '1 diária livre' : `${freeNightsAhead} diárias livres`}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-linen/70">
                  É o que ainda dá para vender nos próximos 7 dias, considerando as reservas já
                  lançadas. Uma divulgação agora pega quem decide em cima da hora.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-4 font-serif text-xl font-semibold">Semana cheia</h2>
                <p className="mt-2 text-sm leading-relaxed text-linen/70">
                  Todas as diárias dos próximos 7 dias estão ocupadas. Bom momento para trabalhar as
                  datas mais adiante.
                </p>
              </>
            )}
            <Link
              href="/dashboard/marketing"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:brightness-105"
            >
              Abrir marketing
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/40 blur-2xl" />
        </div>
      </div>
    </DashboardShell>
  )
}
