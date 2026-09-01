'use client'

import {
  LayoutDashboard,
  CalendarCheck,
  BedDouble,
  Wallet,
  MessageSquare,
  Star,
  Megaphone,
  Bot,
  Settings,
  TrendingUp,
  Clock,
  ArrowDownCircle,
  Scale,
} from 'lucide-react'
import { DashboardShell, type NavItem } from '@/components/dashboard/shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { ExpenseForm } from './expense-form'
import type { FinanceSummary, Transaction } from '../types'

const nav: NavItem[] = [
  { label: 'Visão geral', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Reservas', icon: CalendarCheck, href: '/dashboard/reservas' },
  { label: 'Financeiro', icon: Wallet, href: '/dashboard/financeiro', active: true },
  { label: 'Acomodações', icon: BedDouble, href: '/dashboard/acomodacoes' },
  { label: 'Mensagens', icon: MessageSquare, href: '/dashboard/mensagens' },
  { label: 'Avaliações', icon: Star, href: '/dashboard/avaliacoes' },
  { label: 'Marketing', icon: Megaphone, href: '/dashboard/marketing' },
  { label: 'Assistente IA', icon: Bot, href: '/dashboard/assistente' },
  { label: 'Configurações', icon: Settings, href: '/dashboard/configuracoes' },
]

function brl(n: number): string {
  return 'R$ ' + n.toLocaleString('pt-BR')
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export function FinanceView({
  displayName,
  pousadaName,
  summary,
  transactions,
}: {
  displayName: string
  pousadaName: string
  summary: FinanceSummary
  transactions: Transaction[]
}) {
  const cards = [
    { label: 'Receita realizada', value: brl(summary.revenueConfirmed), icon: TrendingUp, tone: 'primary' as const },
    { label: 'A receber', value: brl(summary.revenuePending), icon: Clock, tone: 'ocean' as const },
    { label: 'Despesas', value: brl(summary.expensesTotal), icon: ArrowDownCircle, tone: 'accent' as const },
    { label: 'Saldo', value: brl(summary.balance), icon: Scale, tone: 'primary' as const },
  ]

  return (
    <DashboardShell
      nav={nav}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Financeiro"
      subtitle="Receitas, despesas e fluxo de caixa da sua pousada."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <span
              className={`flex size-10 items-center justify-center rounded-xl ${
                c.tone === 'ocean' ? 'bg-ocean/10 text-ocean' : c.tone === 'accent' ? 'bg-accent/15 text-accent' : 'bg-primary/10 text-primary'
              }`}
            >
              <c.icon className="size-5" />
            </span>
            <div className="mt-4 text-2xl font-semibold text-foreground">{c.value}</div>
            <div className="text-sm text-muted-foreground">{c.label}</div>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <h2 className="font-semibold text-foreground">Extrato</h2>
          <p className="text-sm text-muted-foreground">Receitas de reservas e despesas lançadas.</p>
          <div className="mt-4 overflow-x-auto">
            {transactions.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Sem movimentações"
                description="As receitas das reservas e as despesas que você lançar aparecem aqui."
              />
            ) : (
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground">{fmtDate(t.date)}</TableCell>
                      <TableCell className="font-medium text-foreground">{t.description}</TableCell>
                      <TableCell>
                        <Badge variant={t.kind === 'receita' ? 'primarySoft' : 'accentSoft'} size="sm">
                          {t.kind === 'receita' ? 'Receita' : 'Despesa'}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${t.kind === 'receita' ? 'text-primary' : 'text-accent'}`}
                      >
                        {t.kind === 'receita' ? '+' : '−'} {brl(t.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-foreground">Lançar despesa</h2>
          <p className="text-sm text-muted-foreground">Registre uma conta a pagar.</p>
          <div className="mt-4">
            <ExpenseForm />
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}
