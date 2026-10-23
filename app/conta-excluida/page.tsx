import type { Metadata } from 'next'
import Link from 'next/link'
import { UserX } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Conta excluída',
  robots: { index: false, follow: false },
}

/** Por requisição: a CSP estrita de `proxy.ts` usa nonce (ver app/dynamic-pages.test.ts). */
export const dynamic = 'force-dynamic'

/** Destino depois de "Excluir minha conta" (0090). A sessão já foi encerrada. */
export default function ContaExcluidaPage() {
  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="bg-background flex min-h-screen items-center justify-center px-5"
    >
      <EmptyState
        size="lg"
        as="h1"
        icon={UserX}
        title="Conta excluída"
        description="Seus dados pessoais foram apagados e você saiu da conta. As pousadas guardam só o registro das estadias, como a lei exige. Obrigado por ter viajado com a gente."
        action={
          <Link href="/" className={buttonVariants({ size: 'lg' })}>
            Voltar para o início
          </Link>
        }
      />
    </main>
  )
}
