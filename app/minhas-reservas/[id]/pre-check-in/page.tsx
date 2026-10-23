import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CalendarCheck, CheckCircle2, ClipboardList } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { buttonVariants } from '@/components/ui/button'
import { getCurrentUser, getMyPrecheckinData, getMyProfile } from '@/server/queries'
import { maskedDocument } from '@/features/auth/profile'
import {
  buildPrecheckinDefaults,
  precheckinPath,
  storedCompanionDocuments,
} from '@/features/reservas/precheckin'
import { PrecheckinForm } from '@/features/reservas/components/precheckin-form'
import { formatDateTime, formatISODate } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Ficha de hospedagem',
  robots: { index: false, follow: false },
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Pré-check-in online (0088). Login obrigatório (proxy + aqui); reserva que
 * não é do usuário logado responde 404, igual a uma que não existe.
 */
export default async function PreCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(precheckinPath(id))}`)
  if (!UUID.test(id)) notFound()

  const [snapshot, me] = await Promise.all([getMyPrecheckinData(id), getMyProfile()])
  if (!snapshot) notFound()

  const ficha = snapshot.responsible
  const storedDocument =
    ficha.hasDocument && ficha.documentType
      ? {
          type: ficha.documentType,
          label: maskedDocument(ficha.documentType, ficha.documentLast4) ?? ficha.documentType,
        }
      : null

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="pt-32 pb-24">
        <Container className="max-w-2xl">
          <Breadcrumb
            items={[
              { label: 'Minhas reservas', href: '/minhas-reservas' },
              { label: 'Ficha de hospedagem' },
            ]}
          />
          <h1 className="text-h1 text-foreground mt-4">Ficha de hospedagem</h1>
          <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-foreground font-medium">{snapshot.pousadaName}</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarCheck className="size-4" />
              {formatISODate(snapshot.checkin)} – {formatISODate(snapshot.checkout)}
            </span>
            <span>Código {snapshot.code}</span>
          </p>

          {snapshot.precheckinCompletedAt && snapshot.canSubmit && (
            <div
              role="status"
              className="border-success/30 bg-success/10 text-foreground mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm"
            >
              <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" />
              <span>
                Ficha enviada em {formatDateTime(snapshot.precheckinCompletedAt)}. Se algo mudou,
                corrija abaixo e envie de novo.
              </span>
            </div>
          )}

          <Card radius="3xl" className="mt-6 p-5 sm:p-8">
            {snapshot.canSubmit ? (
              <PrecheckinForm
                initial={buildPrecheckinDefaults(snapshot, me?.profile ?? null)}
                fullName={ficha.fullName}
                storedDocument={storedDocument}
                storedCompanionDocuments={storedCompanionDocuments(snapshot)}
                limits={{ maxCompanions: snapshot.maxCompanions, maxInfants: snapshot.maxInfants }}
                checkinTime={snapshot.checkinTime}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <ClipboardList className="text-muted-foreground size-10" />
                <h2 className="text-h3 text-foreground">
                  {snapshot.precheckinCompletedAt
                    ? 'Ficha enviada.'
                    : 'A ficha não pode mais ser preenchida por aqui.'}
                </h2>
                <p className="text-muted-foreground max-w-md text-sm">
                  {snapshot.precheckinCompletedAt
                    ? 'Na chegada é só confirmar com a recepção.'
                    : snapshot.status === 'cancelled'
                      ? 'Esta reserva foi cancelada.'
                      : 'A ficha online fica aberta até o check-in. Fale com a recepção da pousada.'}
                </p>
                <Link
                  href="/minhas-reservas"
                  className={buttonVariants({ variant: 'outline', size: 'pill' })}
                >
                  Voltar para minhas reservas
                </Link>
              </div>
            )}
          </Card>
        </Container>
      </main>
      <SiteFooter />
    </div>
  )
}
