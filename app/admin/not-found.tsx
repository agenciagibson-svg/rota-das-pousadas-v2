import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'

export default function AdminNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-5">
      <EmptyState
        icon={BarChart3}
        title="Relatório não encontrado"
        description="Esta seção administrativa não existe ou ainda não está disponível."
        action={
          <Link href="/admin" className={buttonVariants()}>
            Voltar ao painel executivo
          </Link>
        }
      />
    </div>
  )
}
