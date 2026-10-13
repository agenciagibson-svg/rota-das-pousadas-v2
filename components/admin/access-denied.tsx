import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { LogoutButton } from '@/features/auth/components/logout-button'

/** Usuário autenticado, mas sem `platformRole` — não é equipe da plataforma. */
export function AdminAccessDenied() {
  return (
    <div className="bg-secondary/40 flex min-h-screen items-center justify-center px-5">
      <EmptyState
        size="lg"
        as="h1"
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Esse painel é só para a equipe da Rota das Pousadas. Se você é dono de pousada, entre pelo painel de parceiro."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/parceiros/login" className={buttonVariants()}>
              Painel do parceiro
            </Link>
            <LogoutButton />
          </div>
        }
      />
    </div>
  )
}
