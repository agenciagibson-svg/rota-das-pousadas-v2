import type { Metadata } from 'next'
import { Card } from '@/components/ui/card'
import { LoginForm } from '@/features/auth'
import { DemoNotice } from '@/components/demo/demo-notice'
import { isSupabaseConfigured } from '@/lib/env'

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
      {!isSupabaseConfigured() && (
        <DemoNotice
          className="mt-6"
          action={{ href: '/minhas-reservas', label: 'Ver a área do hóspede' }}
        >
          Este ambiente de teste não tem banco conectado, então o login não funciona aqui.
        </DemoNotice>
      )}
      <div className="mt-6">
        <LoginForm next={next} />
      </div>
    </Card>
  )
}
