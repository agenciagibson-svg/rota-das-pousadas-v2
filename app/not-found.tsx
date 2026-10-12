import Link from 'next/link'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'

/**
 * Força renderização por requisição. Sem isso o Next pré-renderiza a rota
 * especial `/_not-found` estaticamente no build (é a única página do site
 * sem cookie/searchParams/query que force isso sozinha) — e como a CSP
 * estrita (ver `proxy.ts`) depende de nonce por requisição, os próprios
 * scripts inline que o Next injeta pra hidratar essa página ficariam
 * bloqueados em produção, resultando em página em branco.
 */
export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-5">
      <EmptyState
        size="lg"
        icon={Compass}
        title="Página não encontrada"
        description="A rota que você procura não existe ou foi movida. Vamos recomeçar do início."
        action={
          <Link href="/" className={buttonVariants({ size: 'lg' })}>
            Voltar para o início
          </Link>
        }
      />
    </div>
  )
}
