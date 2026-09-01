import Link from 'next/link'
import { MapPinOff } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'

export default function PousadaNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader forceSolid />
      <main className="flex min-h-[70vh] items-center justify-center px-5">
        <EmptyState
          icon={MapPinOff}
          title="Pousada não encontrada"
          description="Este refúgio não existe mais ou o endereço está incorreto. Explore outros destinos na nossa curadoria."
          action={
            <Link href="/#pousadas" className={buttonVariants()}>
              Ver pousadas em destaque
            </Link>
          }
        />
      </main>
      <SiteFooter />
    </div>
  )
}
