'use client'

import { Clock3, Mail, Phone, Settings } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { OwnerPousadaSettings } from '../types'
import { OwnerSettingsForm } from './owner-settings-form'

export function OwnerSettingsView({
  displayName,
  pousadaName,
  settings,
}: {
  displayName: string
  pousadaName: string
  settings: OwnerPousadaSettings | null
}) {
  return (
    <DashboardShell
      nav={ownerDashboardNav('configuracoes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Configurações"
      subtitle="Ajuste dados operacionais, políticas e preferências da pousada."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      {!settings ? (
        <EmptyState
          icon={Settings}
          title="Nenhuma pousada encontrada"
          description="Cadastre ou selecione uma pousada para editar configurações."
        />
      ) : (
        <div className="grid gap-5 2xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="p-6">
            <h2 className="font-semibold text-foreground">Dados da pousada</h2>
            <p className="text-sm text-muted-foreground">
              Essas informações alimentam a página pública e a operação de reservas.
            </p>
            <div className="mt-6">
              <OwnerSettingsForm settings={settings} />
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock3 className="size-4 text-primary" />
                Horários
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Check-in às {settings.checkinTime}; check-out às {settings.checkoutTime}.
              </p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Phone className="size-4 text-primary" />
                Atendimento
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {settings.contactPhone || 'Telefone não informado.'}
              </p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Mail className="size-4 text-primary" />
                Notificações
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {settings.notificationEmail || 'E-mail de notificação não informado.'}
              </p>
            </Card>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
