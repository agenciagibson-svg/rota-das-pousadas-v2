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
    <Card radius="3xl" border={false} className="p-6 sm:p-8">
      <h1 className="text-h1 text-foreground">Bem-vindo de volta</h1>
      <p className="text-muted-foreground mt-2 text-base">
        Entre para gerenciar suas viagens, favoritos e reservas.
      </p>
      <div className="mt-6">
        <LoginForm next={next} />
      </div>
    </Card>
  )
}
