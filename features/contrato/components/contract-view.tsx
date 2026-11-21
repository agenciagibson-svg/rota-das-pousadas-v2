'use client'

import Link from 'next/link'
import { FileSignature, Gift, Hourglass } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PrintButton } from '@/features/reservas/components/print-button'
import { FOUNDER_COMMISSION_LABEL, PLATFORM_COMMISSION_LABEL } from '@/lib/platform-commission'
import { contractStatus, launchCondition } from '../contract'
import type { AcceptedContract, ContractState } from '../types'
import { ContractAcceptForm } from './contract-accept-form'
import { ContractDocument } from './contract-document'

const DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function LaunchCard({ state, now }: { state: ContractState; now: Date }) {
  const launch = launchCondition(state, now)
  if (!launch) return null
  return (
    <Card className="p-5 print:hidden">
      <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
        <Gift className="text-primary size-4" />
        Pousada fundadora nº {launch.rank}
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        {launch.exemptActive
          ? `Sem comissão até ${DATE.format(new Date(launch.exemptUntil))} (${
              launch.exemptDaysLeft === 1 ? 'falta 1 dia' : `faltam ${launch.exemptDaysLeft} dias`
            }), nas condições do contrato.`
          : `O período sem comissão terminou em ${DATE.format(new Date(launch.exemptUntil))}.`}
        {launch.rateLockedUntil &&
          ` Depois, comissão de ${FOUNDER_COMMISSION_LABEL} até ${DATE.format(new Date(launch.rateLockedUntil))}; a partir daí, ${PLATFORM_COMMISSION_LABEL}.`}
      </p>
    </Card>
  )
}

function MissingData({ missing }: { missing: string[] }) {
  return (
    <div className="border-border bg-muted rounded-2xl border p-4">
      <p className="text-foreground text-sm font-semibold">Falta preencher antes de aceitar</p>
      <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
        {missing.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/dashboard/configuracoes"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Abrir os dados da pousada
        </Link>
        <Link href="/perfil" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Abrir meu perfil
        </Link>
      </div>
    </div>
  )
}

export function ContractView({
  displayName,
  pousadaName,
  state,
  accepted,
  nowISO,
}: {
  displayName: string
  pousadaName: string
  state: ContractState | null
  /** Cópia guardada do último contrato aceito. */
  accepted: AcceptedContract | null
  /** "Agora" do servidor, para a contagem de dias não divergir na hidratação. */
  nowISO: string
}) {
  const status = state ? contractStatus(state) : 'inactive'
  const now = new Date(nowISO)

  return (
    <DashboardShell
      nav={ownerDashboardNav('configuracoes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Contrato com a Rota"
      subtitle="As condições da parceria entre a pousada e a Rota das Pousadas."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      {!state || status === 'inactive' ? (
        <EmptyState
          icon={FileSignature}
          title="Contrato ainda não disponível"
          description="Quando o contrato estiver pronto para aceite, ele aparece aqui e você recebe um aviso no painel."
        />
      ) : (
        <div className="space-y-5">
          <LaunchCard state={state} now={now} />

          {status === 'accepted' && accepted ? (
            <Card className="p-6 print:border-0 print:p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground font-semibold">{accepted.versionTitle}</h2>
                    <Badge variant="primarySoft">Aceito</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Aceito por {accepted.acceptedByName} em{' '}
                    {DATE_TIME.format(new Date(accepted.acceptedAt))} (horário de Brasília) · versão{' '}
                    {accepted.versionCode}
                  </p>
                </div>
                <PrintButton />
              </div>
              <p className="text-muted-foreground mt-2 text-xs print:hidden">
                Para guardar em PDF, use Imprimir e escolha “Salvar como PDF”.
              </p>
              <ContractDocument body={accepted.body} className="mt-5" />
              <p className="text-muted-foreground mt-6 text-xs break-all">
                Aceito eletronicamente por {accepted.acceptedByName} ({accepted.acceptedByEmail}) em{' '}
                {DATE_TIME.format(new Date(accepted.acceptedAt))} (horário de Brasília). Código de
                conferência do texto: {accepted.sha256}
              </p>
            </Card>
          ) : (
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <h2 className="text-foreground font-semibold">{state.version?.title}</h2>
                <Badge variant="goldSoft">
                  {status === 'reaccept' ? 'Versão nova para aceitar' : 'Aguardando aceite'}
                </Badge>
              </div>
              {status === 'reaccept' && state.latestAcceptance && (
                <p className="text-muted-foreground mt-1 text-sm">
                  A versão {state.latestAcceptance.versionCode}, aceita em{' '}
                  {DATE.format(new Date(state.latestAcceptance.acceptedAt))}, continua guardada. O
                  contrato foi atualizado e pede um novo aceite.
                </p>
              )}

              {!state.canAccept || !state.body || !state.bodySha256 || !state.version ? (
                <div className="text-muted-foreground mt-4 flex items-start gap-2 text-sm">
                  <Hourglass className="mt-0.5 size-4 shrink-0" />
                  <p>
                    Só o proprietário da pousada pode ler e aceitar o contrato. Peça para ele entrar
                    no painel e abrir Configurações → Contrato.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Leia o texto inteiro. A pousada só é publicada depois do aceite.
                  </p>
                  {state.missing.length > 0 && (
                    <div className="mt-4">
                      <MissingData missing={state.missing} />
                    </div>
                  )}
                  <div className="border-border mt-5 max-h-96 overflow-y-auto rounded-2xl border p-5">
                    <ContractDocument body={state.body} />
                  </div>
                  <div className="mt-5">
                    <ContractAcceptForm
                      versionId={state.version.id}
                      bodySha256={state.bodySha256}
                      blocked={state.missing.length > 0}
                    />
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      )}
    </DashboardShell>
  )
}
