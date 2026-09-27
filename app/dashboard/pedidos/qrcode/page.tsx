import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { getOwnerPousada } from '@/server/queries'
import { getOrdersScreen } from '@/features/pedidos/services/orders.service'
import { PrintButton } from '@/features/reservas/components/print-button'

/** Folha para imprimir e deixar no quarto. */
export default async function PedidosQrPage() {
  if (await sectionDenied('pedidos')) return <NoSectionAccess section="pedidos" title="Pedidos" />
  const pousada = await getOwnerPousada()
  const { stayUrl, stayQrSvg } = await getOrdersScreen(pousada?.timezone || 'America/Sao_Paulo')

  return (
    <main className="mx-auto max-w-md p-6 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <section className="rounded-3xl border-2 border-neutral-800 p-8 text-center">
        <p className="text-sm font-semibold tracking-widest text-neutral-500 uppercase">
          {pousada?.name}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-neutral-900">
          Peça pelo celular
        </h1>
        <p className="mt-2 text-neutral-600">
          Água, bebidas, toalha extra e mais. Aponte a câmera para o código e entre com a conta da
          sua reserva.
        </p>
        <div
          className="mx-auto mt-6 w-64"
          role="img"
          aria-label="QR Code do app da estadia"
          dangerouslySetInnerHTML={{ __html: stayQrSvg }}
        />
        <p className="mt-4 text-sm break-all text-neutral-500">{stayUrl}</p>
        <p className="mt-6 text-xs text-neutral-500">
          O que você pedir vai para a conta da estadia e é pago no check-out.
        </p>
      </section>
    </main>
  )
}
