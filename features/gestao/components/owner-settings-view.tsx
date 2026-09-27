'use client'

import { Clock3, CreditCard, Mail, Phone, QrCode, Settings, Smartphone, Wallet } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ConnectMpButton } from '@/features/pagamentos/components/connect-mp-button'
import { SubscribeButton } from '@/features/pagamentos/components/subscribe-button'
import { PixSettingsForm } from '@/features/pagamentos/components/pix-settings-form'
import type { PixSettingsInput } from '@/features/pagamentos/pix'
import type { OwnerPousadaSettings } from '../types'
import { GuestSettingsForm } from '@/features/pedidos/components/guest-settings-form'
import type { GuestSettings } from '@/features/pedidos/types'
import { OwnerSettingsForm } from './owner-settings-form'

function formatSubscriptionAmount(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type SubscriptionStatusValue = 'none' | 'pending' | 'authorized' | 'paused' | 'cancelled'

const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatusValue, string> = {
  none: 'Ainda não assinado',
  pending: 'Autorização pendente',
  authorized: 'Ativa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

export function OwnerSettingsView({
  displayName,
  pousadaName,
  settings,
  paymentAccount,
  subscription,
  pix,
  guestSettings = null,
}: {
  guestSettings?: GuestSettings | null
  displayName: string
  pousadaName: string
  settings: OwnerPousadaSettings | null
  paymentAccount: { connected: boolean; liveMode: boolean; canConnect: boolean } | null
  pix: { settings: PixSettingsInput | null; canEdit: boolean } | null
  subscription: {
    planName: string
    planPrice: number
    status: SubscriptionStatusValue
    nextBillingDate: string | null
    canManage: boolean
  } | null
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
            <h2 className="text-foreground font-semibold">Dados da pousada</h2>
            <p className="text-muted-foreground text-sm">
              Essas informações alimentam a página pública e a operação de reservas.
            </p>
            <div className="mt-6">
              <OwnerSettingsForm settings={settings} />
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="text-primary size-4" />
                Horários
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                Check-in às {settings.checkinTime}; check-out às {settings.checkoutTime}.
              </p>
            </Card>
            <Card className="p-5">
              <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Phone className="text-primary size-4" />
                Atendimento
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                {settings.contactPhone || 'Telefone não informado.'}
              </p>
            </Card>
            <Card className="p-5">
              <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Mail className="text-primary size-4" />
                Notificações
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                {settings.notificationEmail || 'E-mail de notificação não informado.'}
              </p>
            </Card>
            <Card className="p-5">
              <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Wallet className="text-primary size-4" />
                Pagamentos
              </div>
              {paymentAccount?.connected ? (
                <p className="text-muted-foreground mt-2 text-sm">
                  Conta Mercado Pago conectada{paymentAccount.liveMode ? '' : ' (modo de teste)'}.
                  Os pagamentos das reservas caem direto nela.
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Conecte sua conta Mercado Pago para receber o pagamento das reservas
                    diretamente.
                  </p>
                  {paymentAccount?.canConnect ? (
                    <div className="mt-3">
                      <ConnectMpButton />
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-3 text-xs">
                      Só o proprietário pode conectar a conta de pagamento.
                    </p>
                  )}
                </>
              )}
            </Card>
            {guestSettings && (
              <Card className="p-5">
                <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <Smartphone className="text-primary size-4" />
                  App do hóspede
                </div>
                <GuestSettingsForm initial={guestSettings} />
              </Card>
            )}
            {pix && (
              <Card className="p-5">
                <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <QrCode className="text-primary size-4" />
                  Pix direto (sem taxa)
                </div>
                <PixSettingsForm initial={pix.settings} canEdit={pix.canEdit} />
              </Card>
            )}
            {subscription && (
              <Card className="p-5">
                <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <CreditCard className="text-primary size-4" />
                  Assinatura
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  Plano {subscription.planName} · {formatSubscriptionAmount(subscription.planPrice)}
                  /mês · {SUBSCRIPTION_STATUS_LABEL[subscription.status]}
                </p>
                {subscription.status === 'authorized' ? null : subscription.canManage ? (
                  <div className="mt-3">
                    <SubscribeButton reassinar={subscription.status === 'cancelled'} />
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-3 text-xs">
                    Só o proprietário pode assinar o plano desta pousada.
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
