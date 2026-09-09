'use client'

import { Clock3, Mail, Phone, Settings, Wallet } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ConnectMpButton } from '@/features/pagamentos/components/connect-mp-button'
import type { OwnerPousadaSettings } from '../types'
import { OwnerSettingsForm } from './owner-settings-form'

export function OwnerSettingsView({
  displayName,
  pousadaName,
  settings,
  paymentAccount,
}: {
  displayName: string
  pousadaName: string
  settings: OwnerPousadaSettings | null
  paymentAccount: { connected: boolean; liveMode: boolean; canConnect: boolean } | null
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
            <Card className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wallet className="size-4 text-primary" />
                Pagamentos
              </div>
              {paymentAccount?.connected ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Conta Mercado Pago conectada{paymentAccount.liveMode ? '' : ' (modo de teste)'}. Os pagamentos das
                  reservas caem direto nela.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Conecte sua conta Mercado Pago para receber o pagamento das reservas diretamente.
                  </p>
                  {paymentAccount?.canConnect ? (
                    <div className="mt-3">
                      <ConnectMpButton />
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Só o proprietário pode conectar a conta de pagamento.
                    </p>
                  )}
                </>
              )}
            </Card>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
