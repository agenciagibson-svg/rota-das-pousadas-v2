import { Compass } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatBRL } from '@/lib/format'
import { monthLabel } from '@/features/comissao'
import { channelLabel } from '../origin'
import type { PlatformChannels } from '@/repositories/attribution.repository'

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—'
}

/**
 * /admin → Relatórios: reservas feitas pelo site no mês, por canal da visita
 * (0106). "Pagas" = pagamento confirmado. Responde qual canal traz reserva
 * que vira dinheiro, não só visita.
 */
export function PlatformChannelsCard({ data }: { data: PlatformChannels }) {
  const rows = [...data.channels].sort((a, b) => b.paid - a.paid || b.created - a.created)
  const total = rows.reduce(
    (acc, r) => ({
      created: acc.created + r.created,
      paid: acc.paid + r.paid,
      paidTotal: acc.paidTotal + r.paidTotal,
    }),
    { created: 0, paid: 0, paidTotal: 0 },
  )

  return (
    <Card className="mt-6 p-6">
      <h2 className="text-foreground flex items-center gap-2 font-semibold">
        <Compass className="text-primary size-4" />
        Reservas por canal ·{' '}
        <span className="capitalize">{data.month ? monthLabel(data.month) : 'mês atual'}</span>
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Reservas feitas pelo site, pela origem da visita: link com UTM ou site de onde a pessoa
        veio. Paga = pagamento confirmado.
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-5 text-sm">
          Nenhuma reserva feita pelo site neste mês.
        </p>
      ) : (
        <Table className="mt-5">
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Reservas</TableHead>
              <TableHead className="text-right">Pagas</TableHead>
              <TableHead className="text-right">Conversão</TableHead>
              <TableHead className="text-right">Valor pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.channel}>
                <TableCell className="font-medium">{channelLabel(r.channel)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.created}</TableCell>
                <TableCell className="text-right tabular-nums">{r.paid}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(r.paid, r.created)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(r.paidTotal)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {total.created}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{total.paid}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {pct(total.paid, total.created)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatBRL(total.paidTotal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
