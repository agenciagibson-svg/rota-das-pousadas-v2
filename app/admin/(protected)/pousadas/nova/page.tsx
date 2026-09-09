import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { AdminCreatePousadaForm } from '@/features/admin/components/admin-create-pousada-form'
import { getCurrentUser } from '@/server/queries'
import { can } from '@/lib/auth/rbac'

export const metadata: Metadata = {
  title: 'Cadastrar pousada — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminNovaPousadaPage() {
  // `platformRole` já é garantido pelo layout do grupo protegido — aqui só a
  // autorização específica desta página (nem todo admin pode criar pousada).
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'pousada:create')) redirect('/admin')

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader forceSolid />
      <main className="pb-24 pt-28">
        <Container className="max-w-2xl">
          <div className="text-center">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Equipe Rota das Pousadas
            </span>
            <h1 className="mt-3 font-serif text-3xl font-semibold text-foreground sm:text-4xl">
              Cadastrar pousada
            </h1>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
              Use o Instagram da pousada como referência para preencher os dados e
              subir as fotos. O proprietário poderá assumir o painel depois.
            </p>
          </div>

          <Card radius="3xl" className="mt-8 p-8 shadow-card">
            <AdminCreatePousadaForm />
          </Card>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/admin" className="font-semibold text-primary hover:underline">
              Voltar ao painel admin
            </Link>
          </p>
        </Container>
      </main>
    </div>
  )
}
