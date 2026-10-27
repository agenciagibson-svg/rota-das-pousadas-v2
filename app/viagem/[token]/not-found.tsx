import { Link2Off } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { EmptyState } from '@/components/ui/empty-state'

/** Link da reserva inexistente, trocado por outro ou desativado por quem reservou. */
export default function SharedTripNotFound() {
  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main
        id="conteudo"
        tabIndex={-1}
        className="flex min-h-[70vh] items-center justify-center px-5"
      >
        <EmptyState
          size="lg"
          as="h1"
          icon={Link2Off}
          title="Link não encontrado"
          description="Este link foi desativado ou trocado por quem fez a reserva. Peça o link novo para essa pessoa."
        />
      </main>
      <SiteFooter />
    </div>
  )
}
