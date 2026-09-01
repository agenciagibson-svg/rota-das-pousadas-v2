import type { Metadata } from 'next'
import { Card } from '@/components/ui/card'
import { LoginForm } from '@/features/auth'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <Card radius="3xl" className="p-8 shadow-card">
      <h1 className="font-serif text-2xl font-semibold text-foreground">Bem-vindo de volta</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Entre para gerenciar suas viagens, favoritos e reservas.
      </p>
      <div className="mt-6">
        <LoginForm next={next} />
      </div>
    </Card>
  )
}
