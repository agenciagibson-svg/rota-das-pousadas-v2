import Link from 'next/link'
import { Ban, Clock3, MapPinned } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { SelectPousadaForm } from './select-pousada-form'

/** Usuário autenticado, mas sem nenhum vínculo (ativo, suspenso ou convite) com pousada alguma. */
export function NoMembershipScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-5">
      <EmptyState
        icon={MapPinned}
        title="Nenhum acesso de gestão ainda"
        description="Sua conta não está vinculada a nenhuma pousada. Cadastre a sua ou peça para um proprietário te convidar."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/anunciar" className={buttonVariants()}>
              Cadastrar minha pousada
            </Link>
            <LogoutButton />
          </div>
        }
      />
    </div>
  )
}

/** Único vínculo do usuário está com status "invited" — ainda não aceito. */
export function InvitedOnlyScreen({ pousadaName }: { pousadaName: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-5">
      <EmptyState
        icon={Clock3}
        title="Convite pendente"
        description={`Você foi convidado para a equipe de ${pousadaName}. Aceite o convite para acessar a gestão.`}
        action={<span className="text-xs text-muted-foreground">Fale com quem te convidou para confirmar.</span>}
      />
    </div>
  )
}

/** Vínculo suspenso — acesso bloqueado até reativação por quem gerencia a pousada. */
export function SuspendedScreen({ pousadaName, reason }: { pousadaName: string; reason: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-5">
      <EmptyState
        icon={Ban}
        title="Acesso suspenso"
        description={`Seu acesso à gestão de ${pousadaName} foi suspenso${reason ? `: ${reason}` : '.'} Fale com o proprietário para reativar.`}
        action={<LogoutButton />}
      />
    </div>
  )
}

/** Usuário tem mais de uma pousada ativa e ainda não escolheu qual gerenciar agora. */
export function SelectPousadaScreen({
  options,
}: {
  options: { pousadaId: string; name: string }[]
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-5 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-center font-serif text-2xl font-semibold text-foreground">
          Qual pousada você quer gerenciar?
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Você tem acesso a mais de uma pousada. Escolha para continuar.
        </p>
        <div className="mt-6">
          <SelectPousadaForm options={options} />
        </div>
      </div>
    </div>
  )
}
