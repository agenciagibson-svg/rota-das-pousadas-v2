import Link from 'next/link'
import { Ban, Clock3, FlaskConical, MapPinned } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { PendingInvites } from '@/features/membros/components/pending-invites'
import type { PendingInvite } from '@/features/membros/types'
import { SelectPousadaForm } from './select-pousada-form'

/** Usuário autenticado, mas sem nenhum vínculo (ativo, suspenso ou convite) com pousada alguma. */
export function NoMembershipScreen() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-5">
      <EmptyState
        size="lg"
        as="h1"
        icon={MapPinned}
        title="Nenhum acesso de gestão ainda"
        description="Sua conta não está vinculada a nenhuma pousada. Cadastre a sua ou peça para um proprietário te convidar."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/anunciar" className={buttonVariants({ size: 'lg' })}>
              Cadastrar minha pousada
            </Link>
            <LogoutButton className="h-12 rounded-full px-5" />
          </div>
        }
      />
    </div>
  )
}

/** Preview sem banco conectado: não há login; mostra a demonstração do painel. */
export function DemoModeScreen() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-5">
      <EmptyState
        size="lg"
        as="h1"
        icon={FlaskConical}
        title="Painel da pousada em demonstração"
        description="Este ambiente de teste não tem banco conectado, então não há login de pousada. Veja a visão geral do painel com reservas fictícias."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/parceiros/demonstracao" className={buttonVariants({ size: 'lg' })}>
              Ver painel de demonstração
            </Link>
            <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Voltar ao site
            </Link>
          </div>
        }
      />
    </div>
  )
}

/** Único(s) vínculo(s) do usuário são convites — responde aqui (0049). */
export function InvitedOnlyScreen({ invites }: { invites: PendingInvite[] }) {
  const single = invites.length === 1 ? invites[0] : null
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg">
        <EmptyState
          size="lg"
          as="h1"
          icon={Clock3}
          title={single ? 'Convite pendente' : 'Convites pendentes'}
          description={
            single
              ? `Você foi convidado para a equipe de ${single.pousadaName}. Aceite para acessar a gestão.`
              : 'Você foi convidado para a equipe de mais de uma pousada. Responda a cada convite.'
          }
          action={<LogoutButton className="h-12 rounded-full px-5" />}
        />
        <div className="mt-6">
          <PendingInvites invites={invites} />
        </div>
      </div>
    </div>
  )
}

/** Vínculo suspenso — acesso bloqueado até reativação por quem gerencia a pousada. */
export function SuspendedScreen({
  pousadaName,
  reason,
}: {
  pousadaName: string
  reason: string | null
}) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-5">
      <EmptyState
        size="lg"
        as="h1"
        icon={Ban}
        title="Acesso suspenso"
        description={`Seu acesso à gestão de ${pousadaName} foi suspenso${reason ? `: ${reason}` : '.'} Fale com o proprietário para reativar.`}
        action={<LogoutButton className="h-12 rounded-full px-5" />}
      />
    </div>
  )
}

/** Usuário tem mais de uma pousada ativa e ainda não escolheu qual gerenciar agora. */
export function SelectPousadaScreen({
  options,
  invites = [],
}: {
  options: { pousadaId: string; name: string }[]
  invites?: PendingInvite[]
}) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg">
        <h1 className="text-foreground font-display text-center text-4xl font-medium">
          Qual pousada você quer gerenciar?
        </h1>
        <p className="text-muted-foreground mt-3 text-center text-lg">
          Você tem acesso a mais de uma pousada. Escolha para continuar.
        </p>
        <div className="mt-8">
          <SelectPousadaForm options={options} />
        </div>
        {invites.length > 0 && (
          <div className="mt-10">
            <h2 className="text-foreground font-semibold">Convites pendentes</h2>
            <div className="mt-3">
              <PendingInvites invites={invites} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Faixa discreta no topo do painel para quem já tem vínculo ativo e recebeu convite de outra pousada. */
export function PendingInvitesBanner({ invites }: { invites: PendingInvite[] }) {
  if (invites.length === 0) return null
  return (
    <div className="border-border bg-secondary/40 border-b px-4 py-3 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-foreground mb-2 text-sm font-semibold">Convite de equipe</p>
        <PendingInvites invites={invites} compact />
      </div>
    </div>
  )
}
