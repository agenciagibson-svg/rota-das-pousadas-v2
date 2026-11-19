import { Percent } from 'lucide-react'
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
import { formatBRL } from '@/lib/format'
import { findMonth, monthLabel, rateLabel } from '../commission'
import type { PlatformCommissions } from '../types'
import { CommissionMonthNav } from './commission-month-nav'

/**
 * Comissões de todas as pousadas no /admin → Financeiro (0104). É o registro
 * do que as reservas geraram; a cobrança (cartão e fatura do Pix direto) ainda
 * não existe, então nada aqui é "recebido".
 */
export function PlatformCommissionsCard({
  data,
  basePath,
}: {
  data: PlatformCommissions
  basePath: string
}) {
  const month = findMonth(data.months, data.month)

  return (
    <Card className="p-6">
      <h2 className="text-foreground flex items-center gap-2 font-semibold">
        <Percent className="text-primary size-4" />
        Comissões das reservas ({rateLabel(data.rate)})
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Registradas no check-out das reservas feitas pela plataforma, para pousadas com contrato
        aceito. A cobrança ainda não está ligada: estes valores são o que foi gerado, não o que foi
        recebido.
      </p>

      {data.months.length === 0 ? (
        <p className="text-muted-foreground mt-5 text-sm">
          Nenhuma comissão registrada ainda. Ela aparece quando uma pousada com contrato aceito
          fizer o check-out de uma reserva vinda da Rota.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-xs">
                Gerada em <span className="capitalize">{monthLabel(data.month)}</span>
              </dt>
              <dd className="text-foreground text-lg font-semibold">
                {formatBRL(month?.due ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Dispensada pela isenção</dt>
              <dd className="text-foreground text-lg font-semibold">
                {formatBRL(month?.waived ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Reservas pela Rota</dt>
              <dd className="text-foreground text-lg font-semibold">
                {month?.bookings ?? 0} · {formatBRL(month?.base ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Pousadas com reserva</dt>
              <dd className="text-foreground text-lg font-semibold">{month?.pousadas ?? 0}</dd>
            </div>
          </dl>

          <div className="mt-5">
            <CommissionMonthNav
              months={data.months.map((m) => m.month)}
              current={data.month}
              basePath={basePath}
            />
          </div>

          {data.pousadas.length === 0 ? (
            <p className="text-muted-foreground mt-5 text-sm">
              Nenhuma comissão em {monthLabel(data.month)}.
            </p>
          ) : (
            <Table className="mt-5">
              <TableHeader>
                <TableRow>
                  <TableHead>Pousada</TableHead>
                  <TableHead className="text-right">Reservas</TableHead>
                  <TableHead className="text-right">Valor das reservas</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right">Dispensada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pousadas.map((p) => (
                  <TableRow key={p.pousadaId}>
                    <TableCell className="font-medium">
                      <span className="flex flex-wrap items-center gap-2">
                        {p.name}
                        {p.founderRank && (
                          <Badge variant="primarySoft">Fundadora nº {p.founderRank}</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{p.bookings}</TableCell>
                    <TableCell className="text-right">{formatBRL(p.base)}</TableCell>
                    <TableCell className="text-right">{formatBRL(p.due)}</TableCell>
                    <TableCell className="text-right">{formatBRL(p.waived)}</TableCell>
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
