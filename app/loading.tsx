import { SiteHeader } from '@/components/site-header'
import { Loading } from '@/components/ui/loading'

/**
 * Tela entre páginas. O cabeçalho fica (com o card do usuário já conhecido):
 * antes a tela inteira piscava sem ele a cada troca de página.
 */
export default function RootLoading() {
  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main className="flex min-h-screen items-center justify-center">
        <Loading label="Preparando sua rota…" size="lg" />
      </main>
    </div>
  )
}
