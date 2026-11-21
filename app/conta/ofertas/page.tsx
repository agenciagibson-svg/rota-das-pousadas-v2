import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Gift } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { getCurrentUser, getMyOfferConsents } from '@/server/queries'
import { OfferConsentList } from '@/features/ofertas/components/offer-consent-list'

export const metadata: Metadata = {
  title: 'Ofertas das pousadas',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

/**
 * Ofertas que o hóspede autorizou (0111). É para cá que leva o "Parar de
 * receber ofertas" do e-mail: uma pousada por linha, liga e desliga na hora.
 */
export default async function OfertasPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/conta/ofertas')
  const consents = await getMyOfferConsents().catch(() => [])

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="pt-32 pb-24">
        <Container className="max-w-2xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="bg-ipe text-breu grid size-12 place-items-center rounded-full">
              <Gift className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-h1 text-foreground">Ofertas das pousadas</h1>
              <p className="text-muted-foreground text-sm">
                Descontos para voltar, só das pousadas que você autorizou.
              </p>
            </div>
          </div>
          <Card radius="3xl" border={false} className="p-6">
            {consents.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Você ainda não autorizou nenhuma pousada. Depois de uma estadia, o app da estadia
                pergunta se você quer receber ofertas daquela pousada.
              </p>
            ) : (
              <OfferConsentList consents={consents} />
            )}
          </Card>
          <p className="text-muted-foreground mt-4 text-xs">
            Cada pousada manda no máximo 1 oferta por mês, e você recebe no máximo 3 por mês no
            total. A pousada não vê seu e-mail nem seu telefone: quem envia é a Rota.{' '}
            <Link href="/conta" className="underline">
              Voltar ao perfil
            </Link>
          </p>
        </Container>
      </main>
      <SiteFooter />
    </div>
  )
}
