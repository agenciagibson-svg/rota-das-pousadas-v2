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
    <Card radius="3xl" border={false} className="p-6 sm:p-8">
      <h1 className="text-h1 text-foreground">Crie sua conta</h1>
      <p className="text-muted-foreground mt-2 text-base">
        Comece a planejar sua próxima rota pelo Brasil.
      </p>
      <div className="mt-6">
        <SignupForm next={next} />
      </div>
    </Card>
  )
}
