import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { notFound } from 'next/navigation'
import { getBookingFnrh } from '@/server/queries'
import { FnrhPrintView } from '@/features/reservas/components/fnrh-print-view'
import { EmptyState } from '@/components/ui/empty-state'
import { ShieldAlert } from 'lucide-react'

/**
 * Ficha FNRH imprimível de uma reserva. Fora do `DashboardShell` de
 * propósito — sem menu lateral/topo para não ir para o papel; a página
 * detalhe da reserva linka aqui com `target="_blank"`.
 */
export default async function BookingFnrhPage({ params }: { params: Promise<{ id: string }> }) {
  if (await sectionDenied('reservas'))
    return <NoSectionAccess section="reservas" title="Ficha FNRH" />

  const { id } = await params

  let data
  try {
    data = await getBookingFnrh(id)
  } catch (error) {
    console.error('[dashboard] falha ao carregar reserva', error)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState
          icon={ShieldAlert}
          title="Não foi possível abrir esta reserva"
          description="Tente de novo em instantes. Se continuar, confira se a reserva é desta pousada."
        />
      </div>
    )
  }
  if (!data) notFound()

  return <FnrhPrintView data={data} bookingId={id} />
}
