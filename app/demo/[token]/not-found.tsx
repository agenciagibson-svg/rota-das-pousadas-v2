import { Link2Off } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { EmptyState } from '@/components/ui/empty-state'

/** Link de demonstração inexistente, trocado por outro ou desativado pela equipe da Rota. */
export default function DemoNotFound() {
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
          title="Demonstração não encontrada"
          description="Este link foi desativado ou trocado por um novo. Peça o link atualizado para quem te enviou."
        />
      </main>
      <SiteFooter />
    </div>
  )
}
