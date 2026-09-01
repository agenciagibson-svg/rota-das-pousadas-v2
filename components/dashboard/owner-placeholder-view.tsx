'use client'

import { ArrowUpRight, Bot, CheckCircle2, Megaphone, MessageSquare, Settings, Star } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav, type OwnerDashboardSection } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'

const sectionIcons = {
  mensagens: MessageSquare,
  avaliacoes: Star,
  marketing: Megaphone,
  assistente: Bot,
  configuracoes: Settings,
  overview: MessageSquare,
  reservas: MessageSquare,
  hospedes: MessageSquare,
  financeiro: MessageSquare,
  acomodacoes: MessageSquare,
  membros: MessageSquare,
} satisfies Record<OwnerDashboardSection, typeof MessageSquare>

export function OwnerPlaceholderView({
  section,
  displayName,
  pousadaName,
  title,
  subtitle,
  items,
}: {
  section: OwnerDashboardSection
  displayName: string
  pousadaName: string
  title: string
  subtitle: string
  items: string[]
}) {
  const Icon = sectionIcons[section]

  return (
    <DashboardShell
      nav={ownerDashboardNav(section)}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title={title}
      subtitle={subtitle}
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">Área preparada para a próxima etapa.</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-border p-4">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-foreground">Próxima implementação</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            O menu agora navega corretamente. Esta tela fica pronta para receber dados reais quando
            avançarmos nessa área do sistema.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <ArrowUpRight className="size-3.5" />
            Sem página quebrada
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}
