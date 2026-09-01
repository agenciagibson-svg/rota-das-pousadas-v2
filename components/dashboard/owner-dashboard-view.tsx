'use client'

import {
  LayoutDashboard,
  CalendarCheck,
  BedDouble,
  MessageSquare,
  Star,
  Megaphone,
  Bot,
  Settings,
  TrendingUp,
  DollarSign,
  Users,
  ArrowUpRight,
  Sparkles,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { DashboardShell, type NavItem } from '@/components/dashboard/shell'
import { AreaChart, BarChart, Donut } from '@/components/dashboard/charts'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { Building2 } from 'lucide-react'
import { OwnerReservationsTable } from '@/features/gestao/components/owner-reservations-table'
import type { OwnerReservation } from '@/features/gestao/types'

const nav: NavItem[] = [
  { label: 'Visão geral', icon: LayoutDashboard, href: '/dashboard', active: true },
  { label: 'Reservas', icon: CalendarCheck, href: '/dashboard/reservas' },
  { label: 'Financeiro', icon: Wallet, href: '/dashboard/financeiro' },
  { label: 'Acomodações', icon: BedDouble, href: '/dashboard/acomodacoes' },
  { label: 'Mensagens', icon: MessageSquare, href: '/dashboard/mensagens' },
  { label: 'Avaliações', icon: Star, href: '/dashboard/avaliacoes' },
  { label: 'Marketing', icon: Megaphone, href: '/dashboard/marketing' },
  { label: 'Assistente IA', icon: Bot, href: '/dashboard/assistente' },
  { label: 'Configurações', icon: Settings, href: '/dashboard/configuracoes' },
]

const revenue = [32, 40, 38, 52, 48, 61, 58, 70, 66, 78, 74, 84]
const bookings = [12, 18, 15, 22, 28, 34, 30]
const bookingLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const messages = [
  { name: 'Beatriz Lima', text: 'Vocês aceitam pets de grande porte?', time: '2 min' },
  { name: 'Eduardo M.', text: 'Tem disponibilidade para o feriado?', time: '1 h' },
  { name: 'Fernanda R.', text: 'O café da manhã vai até que horas?', time: '3 h' },
]

/**
 * View (client) do painel do proprietário. Recebe apenas dados serializáveis
 * (nome do usuário) do Server Component pai — ícones e interatividade vivem aqui,
 * respeitando a fronteira server/client do App Router.
 */
export function OwnerDashboardView({
  displayName,
  pousadaName,
  pousadaStatus,
  reservations,
}: {
  displayName: string
  pousadaName: string | null
  pousadaStatus: string | null
  reservations: OwnerReservation[]
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
      nav={nav}
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
              <h2 className="font-semibold text-foreground">Receita anual</h2>
              <p className="text-sm text-muted-foreground">Últimos 12 meses</p>
            </div>
            <span className="text-sm font-semibold text-primary">R$ {activeRevenue} ativo</span>
          </div>
          <div className="mt-6 h-48">
            <AreaChart data={revenue} />
          </div>
        </div>

        {/* Occupancy */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6">
          <h2 className="self-start font-semibold text-foreground">Ocupação</h2>
          <div className="mt-4">
            <Donut value={82} />
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            8 de 12 acomodações ocupadas esta semana
          </p>
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
          <p className="text-sm text-muted-foreground">Total de 159 diárias</p>
          <div className="mt-6 h-40">
            <BarChart data={bookings} labels={bookingLabels} color="var(--ocean)" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Messages */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Mensagens</h2>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">3 novas</span>
          </div>
          <div className="mt-4 space-y-3">
            {messages.map((m) => (
              <div key={m.name} className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {m.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.time}</span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reviews summary */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground">Avaliações</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="text-4xl font-semibold text-foreground">4.9</div>
            <div>
              <div className="flex text-gold">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-gold" />
                ))}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">328 avaliações</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {[
              ['5', 86],
              ['4', 10],
              ['3', 3],
              ['2', 1],
            ].map(([label, pct]) => (
              <div key={label as string} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-muted-foreground">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI assistant */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-stone-deep p-6 text-linen">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-linen/10 px-3 py-1 text-xs font-semibold text-linen">
              <Sparkles className="size-3.5 text-gold" />
              Assistente IA
            </span>
            <h2 className="mt-4 font-serif text-xl font-semibold">Impulsione sua ocupação</h2>
            <p className="mt-2 text-sm leading-relaxed text-linen/70">
              A IA detectou alta procura para o próximo feriado. Sugerimos um ajuste de +8% na diária
              do Chalé Vale e uma campanha para casais.
            </p>
            <button className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-all hover:brightness-105">
              Gerar campanha
              <ArrowUpRight className="size-4" />
            </button>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/40 blur-2xl" />
        </div>
      </div>
    </DashboardShell>
  )
}
