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
  TrendingDown,
  DollarSign,
  Users,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react'
import { DashboardShell, type NavItem } from '@/components/dashboard/shell'
import { AreaChart, BarChart, Donut } from '@/components/dashboard/charts'

const nav: NavItem[] = [
  { label: 'Visão geral', icon: LayoutDashboard, active: true },
  { label: 'Reservas', icon: CalendarCheck },
  { label: 'Acomodações', icon: BedDouble },
  { label: 'Mensagens', icon: MessageSquare },
  { label: 'Avaliações', icon: Star },
  { label: 'Marketing', icon: Megaphone },
  { label: 'Assistente IA', icon: Bot },
  { label: 'Configurações', icon: Settings },
]

const stats = [
  { label: 'Receita do mês', value: 'R$ 84.320', delta: '+12,4%', up: true, icon: DollarSign },
  { label: 'Reservas ativas', value: '38', delta: '+6', up: true, icon: CalendarCheck },
  { label: 'Taxa de ocupação', value: '82%', delta: '+4,1%', up: true, icon: TrendingUp },
  { label: 'Novos hóspedes', value: '126', delta: '-2,3%', up: false, icon: Users },
]

const revenue = [32, 40, 38, 52, 48, 61, 58, 70, 66, 78, 74, 84]
const bookings = [12, 18, 15, 22, 28, 34, 30]
const bookingLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const reservations = [
  { guest: 'Marina Alves', room: 'Chalé Vale', dates: '14–16 Mar', status: 'Confirmada', value: 'R$ 1.440' },
  { guest: 'Rafael Souza', room: 'Suíte Bosque', dates: '18–21 Mar', status: 'Pendente', value: 'R$ 2.670' },
  { guest: 'Carla Menezes', room: 'Master Panorâmica', dates: '22–24 Mar', status: 'Confirmada', value: 'R$ 2.480' },
  { guest: 'João Prado', room: 'Chalé Vale', dates: '28–30 Mar', status: 'Confirmada', value: 'R$ 1.440' },
]

const messages = [
  { name: 'Beatriz Lima', text: 'Vocês aceitam pets de grande porte?', time: '2 min' },
  { name: 'Eduardo M.', text: 'Tem disponibilidade para o feriado?', time: '1 h' },
  { name: 'Fernanda R.', text: 'O café da manhã vai até que horas?', time: '3 h' },
]

export default function DashboardPage() {
  return (
    <DashboardShell
      nav={nav}
      brandLabel="Refúgio das Nuvens"
      brandSub="Painel do proprietário"
      title="Bom dia, Helena"
      subtitle="Aqui está o resumo da sua pousada hoje, 17 de março."
      user={{ name: 'Helena Costa', role: 'Proprietária' }}
    >
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                  s.up ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                }`}
              >
                {s.up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {s.delta}
              </span>
            </div>
            <div className="mt-4 text-2xl font-semibold text-foreground">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </div>
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
            <span className="text-sm font-semibold text-primary">R$ 742.900 total</span>
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
            <button className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Ver agenda <ArrowUpRight className="size-4" />
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-semibold">Hóspede</th>
                  <th className="pb-3 font-semibold">Acomodação</th>
                  <th className="pb-3 font-semibold">Datas</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reservations.map((r) => (
                  <tr key={r.guest}>
                    <td className="py-3 font-medium text-foreground">{r.guest}</td>
                    <td className="py-3 text-muted-foreground">{r.room}</td>
                    <td className="py-3 text-muted-foreground">{r.dates}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          r.status === 'Confirmada'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-gold/15 text-[color:#8a6d0f]'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 text-right font-semibold text-foreground">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
