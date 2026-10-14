import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Heart } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { confirmFavoriteAction } from '@/features/favoritos/actions'
import { ensureFavorite } from '@/features/favoritos/services/favorites.service'
import { getCurrentUser } from '@/server/queries'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Salvar nos favoritos' }

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Destino do botão "Salvar" de quem ainda não estava logado: depois do login a
 * pessoa volta para cá e a pousada entra nos favoritos.
 *
 * Esta página é um GET, e GET não pode mudar dado por conta de um link
 * qualquer: um link de outro site para `/favoritos/salvar/<slug>` salvava o
 * favorito de quem estivesse logado. Agora só salva direto quando a navegação
 * veio do próprio site (`Sec-Fetch-Site: same-origin`, que é o caso do
 * redirecionamento depois do login). Vindo de fora — ou de um navegador que
 * não manda o cabeçalho — a página pede a confirmação num formulário (POST).
 */
export default async function SaveFavoritePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!SLUG_RE.test(slug) || slug.length > 120) notFound()

  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/favoritos/salvar/${slug}`)}`)

  const fetchSite = (await headers()).get('sec-fetch-site')
  if (fetchSite === 'same-origin') {
    await ensureFavorite(slug)
    redirect(`/pousada/${slug}?favorito=salvo`)
  }

  return (
    <main className="bg-background flex min-h-screen items-center">
      <Container className="max-w-md py-16">
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <Heart className="text-primary size-8" aria-hidden />
          <h1 className="text-foreground font-serif text-2xl font-semibold">
            Salvar esta pousada nos favoritos?
          </h1>
          <p className="text-muted-foreground text-sm">
            Ela fica guardada na sua conta para você comparar e reservar depois.
          </p>
          <form action={confirmFavoriteAction} className="flex w-full flex-col gap-2">
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" size="lg" className="w-full">
              Salvar nos favoritos
            </Button>
            <Link
              href={`/pousada/${slug}`}
              className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'w-full' })}
            >
              Agora não
            </Link>
          </form>
        </Card>
      </Container>
    </main>
  )
}
