import { ReceiptText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatBRL, formatDateTime, formatISODate } from '@/lib/format'
import { BOOKING_STATUS } from '@/features/reservas'
import type { BookingStatus } from '@/features/reservas/types'
import { CommissionMonthNav } from '@/features/comissao/components/commission-month-nav'
import { monthLabel } from '@/features/comissao'
import {
  PIX_PROOF_STATUS_LABEL,
  approvedDiffers,
  sortAuditItems,
  type PixProofStatus,
  type PlatformPixAudit,
} from '../pix-audit'

const STATUS_VARIANT: Record<PixProofStatus, 'goldSoft' | 'primarySoft' | 'destructiveSoft'> = {
  submitted: 'goldSoft',
  approved: 'primarySoft',
  rejected: 'destructiveSoft',
}

function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS[status as BookingStatus]?.label ?? status
}

/**
 * /admin → Financeiro: comprovantes de Pix direto de todas as pousadas (0105).
 * A pousada aprova o comprovante e, com isso, passa a ver o contato do
 * hóspede. Aqui a Rota confere o que foi aprovado, recusado ou ficou parado.
 */
export function PlatformPixAuditCard({
  data,
  basePath,
}: {
  data: PlatformPixAudit
  basePath: string
}) {
  const month = data.months.find((m) => m.month === data.month)
  const items = sortAuditItems(data.items)

  return (
    <Card className="p-6">
      <h2 className="text-foreground flex items-center gap-2 font-semibold">
        <ReceiptText className="text-primary size-4" />
        Comprovantes de Pix
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        A pousada aprova o comprovante (o dinheiro cai na conta dela) e só então vê o e-mail e o
        telefone do hóspede. Confira aqui o que foi aprovado e, principalmente, reserva cancelada
        depois de o pagamento ser aprovado.
      </p>

      {data.months.length === 0 ? (
        <p className="text-muted-foreground mt-5 text-sm">
          Nenhum comprovante de Pix enviado ainda. Eles aparecem quando um hóspede escolher Pix
          direto e anexar o comprovante.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-xs">
                Enviados em <span className="capitalize">{monthLabel(data.month)}</span>
              </dt>
              <dd className="text-foreground text-lg font-semibold">{month?.total ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Aprovados</dt>
              <dd className="text-foreground text-lg font-semibold">{month?.approved ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Recusados · em análise</dt>
              <dd className="text-foreground text-lg font-semibold">
                {month?.rejected ?? 0} · {month?.submitted ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Cancelada depois de aprovado</dt>
              <dd
                className={
                  (month?.cancelledAfterApproval ?? 0) > 0
                    ? 'text-destructive text-lg font-semibold'
                    : 'text-foreground text-lg font-semibold'
                }
              >
                {month?.cancelledAfterApproval ?? 0}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <CommissionMonthNav
              months={data.months.map((m) => m.month)}
              current={data.month}
              basePath={basePath}
              param="pix"
              label="Mês dos comprovantes"
            />
          </div>

          {items.length === 0 ? (
            <p className="text-muted-foreground mt-5 text-sm">
              Nenhum comprovante em {monthLabel(data.month)}.
            </p>
          ) : (
            <Table className="mt-5">
              <TableHeader>
                <TableRow>
                  <TableHead>Pousada · reserva</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Comprovante</TableHead>
                  <TableHead>Reserva hoje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.proofId}>
                    <TableCell>
                      <span className="text-foreground block font-medium">{item.pousadaName}</span>
                      <span className="text-muted-foreground text-xs">
                        {item.bookingCode} · {formatISODate(item.checkin)} →{' '}
                        {formatISODate(item.checkout)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="block">{formatBRL(item.amount)}</span>
                      {approvedDiffers(item) && (
                        <span className="text-muted-foreground block text-xs">
                          aprovado {formatBRL(item.approvedAmount)}
                        </span>
                      )}
                      <span className="text-muted-foreground block text-xs">
                        reserva {formatBRL(item.bookingTotal)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[item.status]} size="sm">
                          {PIX_PROOF_STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary text-xs hover:underline"
                          >
                            Abrir
                          </a>
                        )}
                      </span>
                      {item.rejectionReason && (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          {item.rejectionReason}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.cancelledAfterApproval ? (
                        <Badge variant="destructiveSoft" size="sm">
                          Cancelada depois de aprovada
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {bookingStatusLabel(item.bookingStatus)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Card>
  )
}
