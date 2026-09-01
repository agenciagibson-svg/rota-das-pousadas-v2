import Link from 'next/link'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <EmptyState
        icon={Compass}
        title="Página não encontrada"
        description="A rota que você procura não existe ou foi movida. Vamos recomeçar do início."
        action={
          <Link href="/" className={buttonVariants()}>
            Voltar para o início
          </Link>
        }
      />
    </div>
  )
}
