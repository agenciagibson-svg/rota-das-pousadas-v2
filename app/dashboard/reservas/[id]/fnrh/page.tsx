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
  const { id } = await params

  let data
  try {
    data = await getBookingFnrh(id)
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState icon={ShieldAlert} title="Sem permissão" description="Você não tem acesso a reservas desta pousada." />
      </div>
    )
  }
  if (!data) notFound()

  return <FnrhPrintView data={data} bookingId={id} />
}
