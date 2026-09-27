import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Heart,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { getCurrentUser, getMyProfile } from '@/server/queries'
import { TravelerProfileForm } from '@/features/auth/components/traveler-profile-form'
import { maskedDocument, safeNextPath } from '@/features/auth/profile'

export const metadata: Metadata = {
  title: 'Meu perfil',
  robots: { index: false, follow: false },
}

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const safeNext = safeNextPath(next)
  const [user, me] = await Promise.all([getCurrentUser(), getMyProfile()])
  if (!user || !me)
    redirect(`/login?next=${encodeURIComponent(safeNext ? `/conta?next=${safeNext}` : '/conta')}`)

  const initials =
    (user.name || user.email)
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  const hasPousada = user.memberships.some((m) => m.status === 'active')
  const p = me.profile

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
              <p className="text-muted-foreground">Seu cadastro na Rota das Pousadas.</p>
            </div>
          </div>

          {me.missing.length > 0 ? (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">
                  {safeNext
                    ? 'Complete seu cadastro para concluir a reserva'
                    : 'Complete seu cadastro para poder reservar'}
                </p>
                <p className="mt-1">
                  A pousada precisa destes dados para a ficha de hospedagem. Falta:{' '}
                  {me.missing.join(', ')}.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              Cadastro completo — suas reservas já levam tudo o que a pousada precisa.
            </div>
          )}

          <Card className="mb-6 p-6">
            <TravelerProfileForm
              email={user.email}
              storedDocumentLabel={maskedDocument(
                p?.documentType ?? null,
                p?.documentLast4 ?? null,
              )}
              initial={{
                fullName: user.name,
                phone: p?.phone ?? '',
                whatsapp: p?.whatsapp ?? '',
                birthDate: p?.birthDate ?? '',
                nationality: me.nationality,
                hasStoredDocument: Boolean(p?.hasDocument),
                country: p && p.country !== 'BR' ? p.country : '',
                cep: p?.cep ?? '',
                address: p?.address ?? '',
                city: p?.city ?? '',
                state: p?.state ?? '',
                emergencyName: p?.emergencyContact.name ?? '',
                emergencyPhone: p?.emergencyContact.phone ?? '',
                dietaryRestrictions: p?.dietaryRestrictions ?? '',
                accessibilityNeeds: p?.accessibilityNeeds ?? '',
                next: safeNext ?? '',
              }}
            />
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
