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
import { formatBRL, formatISODate } from '@/lib/format'
import { findMonth, monthLabel, rateLabel, sumCommissionMonths } from '../commission'
import type { CommissionStatement } from '../types'
import { CommissionMonthNav } from './commission-month-nav'

/**
 * Extrato da comissão da Rota no Financeiro da pousada (0104). Só mostra o que
 * o banco registrou no check-out de cada reserva vinda da plataforma; nada
 * aqui cobra ou marca pagamento.
 */
export function CommissionStatementCard({
  statement,
  basePath,
}: {
  statement: CommissionStatement
  basePath: string
}) {
  const month = findMonth(statement.months, statement.month)
  const all = sumCommissionMonths(statement.months)

  return (
    <Card id="comissao" className="mt-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground flex items-center gap-2 font-semibold">
            <Percent className="text-primary size-4" />
            Comissão da Rota ({rateLabel(statement.rate)})
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Só as reservas feitas pela Rota entram, no mês do check-out. Reserva de balcão e de
            outros canais não gera comissão.
          </p>
        </div>
        {statement.exemptUntil && new Date(statement.exemptUntil) > new Date() && (
          <Badge variant="primarySoft">
            Sem comissão até {formatISODate(statement.exemptUntil.slice(0, 10))}
          </Badge>
        )}
      </div>

      {statement.months.length === 0 ? (
        <p className="text-muted-foreground mt-5 text-sm">
          Nenhuma reserva feita pela Rota com check-out até agora.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-xs">
                Comissão de <span className="capitalize">{monthLabel(statement.month)}</span>
              </dt>
              <dd className="text-foreground text-lg font-semibold">
                {formatBRL(month?.due ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Dispensada pela isenção no mês</dt>
              <dd className="text-foreground text-lg font-semibold">
                {formatBRL(month?.waived ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Reservas pela Rota (últimos meses)</dt>
              <dd className="text-foreground text-lg font-semibold">
                {all.bookings} · {formatBRL(all.base)}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <CommissionMonthNav
              months={statement.months.map((m) => m.month)}
              current={statement.month}
              basePath={basePath}
            />
          </div>

          {statement.items.length === 0 ? (
            <p className="text-muted-foreground mt-5 text-sm">
              Nenhuma reserva pela Rota com check-out em {monthLabel(statement.month)}.
            </p>
          ) : (
            <Table className="mt-5">
              <TableHeader>
                <TableRow>
                  <TableHead>Reserva</TableHead>
                  <TableHead>Estadia</TableHead>
                  <TableHead className="text-right">Valor da reserva</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.items.map((item) => (
                  <TableRow key={item.bookingId}>
                    <TableCell className="font-medium">{item.code}</TableCell>
                    <TableCell>
                      {formatISODate(item.checkin)} a {formatISODate(item.checkout)}
                    </TableCell>
                    <TableCell className="text-right">{formatBRL(item.base)}</TableCell>
                    <TableCell className="text-right">
                      {item.exempt ? (
                        <span className="text-muted-foreground">
                          Isenta ({formatBRL(item.amount)})
                        </span>
                      ) : (
                        formatBRL(item.amount)
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
