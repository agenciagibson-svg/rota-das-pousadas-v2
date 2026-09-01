import type { Metadata } from 'next'
import { Card } from '@/components/ui/card'
import { SignupForm } from '@/features/auth'

export const metadata: Metadata = {
  title: 'Criar conta',
  robots: { index: false, follow: false },
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <Card radius="3xl" className="p-8 shadow-card">
      <h1 className="font-serif text-2xl font-semibold text-foreground">Crie sua conta</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Comece a planejar sua próxima rota pelo Brasil.
      </p>
      <div className="mt-6">
        <SignupForm next={next} />
      </div>
    </Card>
  )
}
