import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Eye } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PousadaDetail } from '@/components/pousada/pousada-detail'
import { getDemoPage } from '@/server/queries'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ token: string }> }

// Link privado: fora de busca e sem mandar o endereço (com o token) adiante.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const page = await getDemoPage(token)
  const name = page?.kind === 'demo' ? page.pousada.name : null
  return {
    title: name ? `${name} na Rota das Pousadas (demonstração)` : 'Demonstração',
    description: name
      ? `Veja como a ${name} ficaria na Rota das Pousadas, com reserva direta e sem comissão.`
      : undefined,
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
  }
}

/**
 * Link de demonstração (0101): a página da pousada como ela ficaria na Rota,
 * para mostrar ao dono antes de ele ser cliente. Mesma página pública, sem
 * reservar, favoritar ou compartilhar. Se a pousada já foi publicada, vai
 * para o endereço de verdade.
 */
export default async function DemoPage({ params }: Props) {
  const { token } = await params
  const page = await getDemoPage(token)
  if (!page) notFound()
  if (page.kind === 'published') redirect(`/pousada/${encodeURIComponent(page.slug)}`)

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1}>
        <PousadaDetail
          pousada={page.pousada}
          room={null}
          rooms={page.rooms}
          reviews={[]}
          favorite={false}
          isLoggedIn={false}
          demo
        />
      </main>
      <div
        role="note"
        className="bg-breu/90 text-primary-foreground shadow-premium fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-full px-5 py-3 text-sm backdrop-blur-md"
      >
        <Eye className="size-4 shrink-0" aria-hidden="true" />
        <span>
          Demonstração preparada para a <strong>{page.pousada.name}</strong>. Nada aqui está
          publicado.
        </span>
      </div>
      <SiteFooter />
    </div>
  )
}
