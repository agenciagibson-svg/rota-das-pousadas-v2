import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { CreatePousadaForm } from '@/features/onboarding'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Anuncie sua pousada',
  robots: { index: false, follow: false },
}

export default async function AnunciarPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/anunciar')

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader forceSolid />
      <main className="pb-24 pt-28">
        <Container className="max-w-2xl">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Para pousadas
            </span>
            <h1 className="mt-3 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
              Anuncie sua pousada
            </h1>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
              Cadastre sua pousada, gerencie reservas e ganhe distribuição no maior
              ecossistema de pousadas do Brasil. Sem comissão sobre reservas.
            </p>
          </div>

          <Card radius="3xl" className="mt-8 p-8 shadow-card">
            <CreatePousadaForm />
          </Card>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/dashboard" className="font-semibold text-primary hover:underline">
              Ir para o painel
            </Link>
          </p>
        </Container>
      </main>
    </div>
  )
}
