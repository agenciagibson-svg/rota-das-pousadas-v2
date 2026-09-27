import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, Heart, LayoutDashboard, Mail, ShieldCheck } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/server/queries'
import { ProfileNameForm } from '@/features/auth/components/profile-name-form'

export const metadata: Metadata = {
  title: 'Meu perfil',
  robots: { index: false, follow: false },
}

export default async function ContaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=%2Fconta')

  const initials =
    (user.name || user.email)
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  const hasPousada = user.memberships.some((m) => m.status === 'active')

  const shortcuts = [
    { label: 'Minhas reservas', href: '/minhas-reservas', icon: CalendarDays },
    { label: 'Favoritos', href: '/favoritos', icon: Heart },
    ...(hasPousada
      ? [{ label: 'Painel da pousada', href: '/dashboard', icon: LayoutDashboard }]
      : []),
    ...(user.platformRole ? [{ label: 'Painel master', href: '/admin', icon: ShieldCheck }] : []),
  ]

  return (
    <>
      <SiteHeader forceSolid />
      <main className="pt-28 pb-24">
        <Container className="max-w-3xl">
          <div className="mb-8 flex items-center gap-4">
            <span className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-full text-xl font-bold">
              {initials}
            </span>
            <div>
              <h1 className="font-serif text-3xl font-semibold">Meu perfil</h1>
              <p className="text-muted-foreground">Seus dados na Rota das Pousadas.</p>
            </div>
          </div>

          <Card className="mb-6 p-6">
            <h2 className="mb-4 font-semibold">Dados pessoais</h2>
            <ProfileNameForm initialName={user.name} />
            <p className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
              <Mail className="size-4" /> {user.email}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              O nome aparece nas suas reservas e nos e-mails de confirmação.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-semibold">Atalhos</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {shortcuts.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="border-border hover:bg-secondary flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium"
                >
                  <s.icon className="text-primary size-5" />
                  {s.label}
                </Link>
              ))}
            </div>
          </Card>
        </Container>
      </main>
      <SiteFooter />
    </>
  )
}
