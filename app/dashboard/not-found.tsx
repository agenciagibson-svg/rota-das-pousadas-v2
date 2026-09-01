import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-5">
      <EmptyState
        icon={LayoutDashboard}
        title="Seção não encontrada"
        description="Esta área do painel não existe ou ainda não está disponível."
        action={
          <Link href="/dashboard" className={buttonVariants()}>
            Voltar ao painel
          </Link>
        }
      />
    </div>
  )
}
