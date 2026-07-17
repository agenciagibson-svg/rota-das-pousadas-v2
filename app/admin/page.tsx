'use client'

import {
  LayoutDashboard,
  Building2,
  Users,
  Globe,
  BarChart3,
  Settings,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Bot,
  ArrowUpRight,
  MapPin,
  Star,
} from 'lucide-react'
import { DashboardShell, type NavItem } from '@/components/dashboard/shell'
import { AreaChart, BarChart, Donut } from '@/components/dashboard/charts'
import { destinations, pousadas } from '@/lib/data'

const nav: NavItem[] = [
  { label: 'Visão Geral', icon: LayoutDashboard, active: true },
  { label: 'Pousadas', icon: Building2 },
  { label: 'Anfitriões', icon: Users },
  { label: 'Destinos', icon: Globe },
  { label: 'Relatórios', icon: BarChart3 },
  { label: 'Configurações', icon: Settings },
]

const kpis = [
  { label: 'Receita da plataforma', value: 'R$ 2,4M', delta: '+18,2%', icon: DollarSign },
  { label: 'Pousadas ativas', value: '719', delta: '+42', icon: Building2 },
  { label: 'Reservas no mês', value: '9.318', delta: '+11,4%', icon: CheckCircle2 },
  { label: 'Novos anfitriões', value: '86', delta: '+9', icon: Users },
]

const revenue = [120, 138, 132, 160, 175, 168, 190, 205, 198, 224, 240, 262]
const bookingsByRegion = [4200, 3100, 2600, 1800, 1200]
const regionLabels = ['SE', 'S', 'CO', 'NE', 'N']

const pendingHosts = [
  { name: 'Sítio Alto da Boa Vista', owner: 'Helena Prado', location: 'Cunha, SP', status: 'Análise' },
  { name: 'Recanto do Rio', owner: 'Tomás Rocha', location: 'Bonito, MS', status: 'Documentos' },
  { name: 'Villa das Hortênsias', owner: 'Sônia Baptista', location: 'Gramado, RS', status: 'Análise' },
]

export default function AdminPage() {
  return (
    <DashboardShell
      nav={nav}
      brandLabel="Rota Admin"
      brandSub="Painel Master"
      title="Visão geral da plataforma"
      subtitle="Métricas consolidadas de toda a rede de pousadas"
      accent="ocean"
      user={{ name: 'Diretoria Rota', role: 'Administrador Master' }}
    >
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-ocean/10 text-ocean">
                  <k.icon className="size-5" />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  <TrendingUp className="size-3" />
                  {k.delta}
                </span>
              </div>
              <div className="mt-4 text-2xl font-semibold text-foreground">{k.value}</div>
              <div className="text-sm text-muted-foreground">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-semibold text-foreground">Receita mensal</h3>
                <p className="text-sm text-muted-foreground">Últimos 12 meses (R$ mil)</p>
              </div>
              <span className="text-sm font-semibold text-ocean">+18,2%</span>
            </div>
            <div className="h-40">
              <AreaChart data={revenue} color="var(--ocean)" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-serif text-lg font-semibold text-foreground">Taxa de ocupação</h3>
            <p className="text-sm text-muted-foreground">Média da rede</p>
            <div className="mt-2 flex justify-center">
              <Donut value={82} color="var(--ocean)" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-serif text-lg font-semibold text-foreground">Reservas por região</h3>
            <p className="mb-4 text-sm text-muted-foreground">Distribuição nacional</p>
            <div className="h-36">
              <BarChart data={bookingsByRegion} labels={regionLabels} color="var(--ocean)" />
            </div>
          </div>

          {/* Pending approvals */}
          <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-foreground">Aprovações pendentes</h3>
              <button className="inline-flex items-center gap-1 text-sm font-semibold text-ocean">
                Ver todas <ArrowUpRight className="size-4" />
              </button>
            </div>
            <div className="space-y-2">
              {pendingHosts.map((h) => (
                <div key={h.name} className="flex items-center justify-between rounded-xl bg-secondary/50 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{h.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {h.location} · {h.owner}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-foreground sm:inline">
                      {h.status}
                    </span>
                    <button className="rounded-lg bg-ocean px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                      Aprovar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI insight */}
        <div className="rounded-2xl border border-ocean/20 bg-ocean/5 p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ocean text-primary-foreground">
              <Bot className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-semibold text-foreground">Insight da IA Rota</h3>
                <span className="rounded-full bg-ocean/15 px-2 py-0.5 text-[11px] font-semibold text-ocean">Beta</span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                A demanda por <strong className="text-foreground">destinos de serra no inverno</strong> cresceu 24% na
                última semana. Recomendamos destacar Monte Verde e Campos do Jordão na home e sugerir aos anfitriões
                dessas regiões um reajuste dinâmico de +8% nas diárias de fim de semana.
              </p>
            </div>
          </div>
        </div>

        {/* Destinations + Top pousadas */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-4 font-serif text-lg font-semibold text-foreground">Destinos por volume</h3>
            <div className="space-y-3">
              {destinations.slice(0, 5).map((d) => {
                const pct = Math.min(100, Math.round((d.pousadas / 212) * 100))
                return (
                  <div key={d.slug}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {d.name} <span className="text-muted-foreground">· {d.state}</span>
                      </span>
                      <span className="text-muted-foreground">{d.pousadas}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-ocean" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-4 font-serif text-lg font-semibold text-foreground">Pousadas em destaque</h3>
            <div className="space-y-3">
              {pousadas.map((p) => (
                <div key={p.slug} className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
                  <img src={p.image || '/placeholder.svg'} alt={p.name} className="size-12 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{p.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {p.city}, {p.state}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    <Star className="size-4 fill-gold text-gold" />
                    {p.rating.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
