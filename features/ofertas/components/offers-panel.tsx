'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatBRL, formatDateTime, formatISODate } from '@/lib/format'
import type { OfferReportRow } from '@/repositories/offers.repository'
import { sendOfferAction } from '../actions'
import {
  OFFER_KIND_LABEL,
  OFFER_VALID_DAYS_DEFAULT,
  OFFERS_PER_GUEST_PER_MONTH,
  OFFERS_PER_POUSADA_PER_MONTH,
  type OfferKind,
} from '../rules'

const PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50]
const VALIDITY = [15, 30, 60, 90]

const selectClass =
  'border-input bg-card text-foreground focus:border-ring h-11 w-full rounded-xl border px-3 text-sm outline-none'

/**
 * Ofertas para ex-hóspedes (0111), na página de Marketing. Só chega a quem
 * autorizou depois da estadia; a Rota manda o e-mail e a pousada nunca vê o
 * contato. Cada pessoa recebe um cupom só dela, de uso único.
 */
export function OffersPanel({
  audience,
  report,
  children,
}: {
  audience: { consented: number; reachable: number }
  report: OfferReportRow[]
  /** Ofertas automáticas (etapa 5), quando houver. */
  children?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [percent, setPercent] = useState(15)
  const [validDays, setValidDays] = useState(OFFER_VALID_DAYS_DEFAULT)
  const [stayFrom, setStayFrom] = useState('')
  const [stayUntil, setStayUntil] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function send() {
    setError(null)
    startTransition(async () => {
      const res = await sendOfferAction({ percent, validDays, stayFrom, stayUntil, message })
      if (!res.ok) {
        setError(res.fieldErrors ? (Object.values(res.fieldErrors)[0] ?? res.error) : res.error)
        return
      }
      setOpen(false)
      const { sent, emailed, queued } = res.data
      setDone(
        sent === 0
          ? 'Ninguém pode receber agora: quem autorizou já recebeu uma oferta sua neste mês.'
          : `Oferta criada para ${sent} ${sent === 1 ? 'pessoa' : 'pessoas'}. ` +
              (queued
                ? emailed > 0
                  ? `${emailed} e-mail(s) enviados; o resto sai às 10h.`
                  : 'Os e-mails saem às 10h (não enviamos propaganda entre 21h e 8h).'
                : 'E-mails enviados.'),
      )
      setMessage('')
      router.refresh()
    })
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl">
            <Gift className="size-5" />
          </span>
          <div>
            <h2 className="text-foreground font-semibold">Ofertas para ex-hóspedes</h2>
            <p className="text-muted-foreground text-sm">
              Um desconto para quem já se hospedou voltar — reservando direto com você.
            </p>
          </div>
        </div>
        <Button
          size="touch"
          onClick={() => {
            setDone(null)
            setOpen(true)
          }}
          disabled={audience.reachable === 0}
        >
          <Send className="size-4" /> Nova oferta
        </Button>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="bg-secondary rounded-2xl p-4">
          <dt className="text-muted-foreground text-xs">Autorizaram receber</dt>
          <dd className="text-foreground font-display mt-1 text-2xl">{audience.consented}</dd>
        </div>
        <div className="bg-secondary rounded-2xl p-4">
          <dt className="text-muted-foreground text-xs">Podem receber agora</dt>
          <dd className="text-foreground font-display mt-1 text-2xl">{audience.reachable}</dd>
        </div>
      </dl>
      <p className="text-muted-foreground mt-3 max-w-prose text-xs">
        Só recebe quem marcou &ldquo;quero receber ofertas&rdquo; depois da estadia. Cada pessoa
        recebe no máximo {OFFERS_PER_POUSADA_PER_MONTH} oferta por mês da sua pousada (e{' '}
        {OFFERS_PER_GUEST_PER_MONTH} por mês de todas as pousadas). Quem já tem reserva marcada aí
        não recebe. Você não vê o e-mail nem o telefone de ninguém: quem envia é a Rota.
      </p>

      {done && (
        <p role="status" className="text-primary mt-4 text-sm font-medium">
          {done}
        </p>
      )}

      {children}

      <h3 className="text-foreground mt-6 text-sm font-semibold">Ofertas enviadas</h3>
      {report.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">Nenhuma oferta enviada ainda.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="py-2 pr-3 font-medium">Quando</th>
                <th className="py-2 pr-3 font-medium">Oferta</th>
                <th className="py-2 pr-3 text-right font-medium">Enviadas</th>
                <th className="py-2 pr-3 text-right font-medium">Abertas</th>
                <th className="py-2 pr-3 text-right font-medium">Reservas</th>
                <th className="py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {report.map((r) => (
                <tr key={r.offerId}>
                  <td className="py-2.5 pr-3 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="py-2.5 pr-3">
                    <span className="text-foreground font-medium">{r.percent}%</span>{' '}
                    <span className="text-muted-foreground">
                      · {OFFER_KIND_LABEL[r.kind as OfferKind] ?? 'Oferta'} · {r.validDays} dias
                      {r.stayFrom && r.stayUntil
                        ? ` · ${formatISODate(r.stayFrom)} a ${formatISODate(r.stayUntil)}`
                        : ''}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.recipients}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.opened}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.booked}</td>
                  <td className="py-2.5 text-right whitespace-nowrap tabular-nums">
                    {formatBRL(r.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nova oferta"
        description={`Vai para ${audience.reachable} ${audience.reachable === 1 ? 'pessoa' : 'pessoas'}, cada uma com um cupom só dela.`}
        footer={
          <>
            <Button variant="ghost" size="touch" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button size="touch" onClick={send} disabled={pending}>
              <Send className="size-4" /> {pending ? 'Enviando…' : 'Enviar oferta'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-foreground font-medium">Desconto</span>
            <select
              className={selectClass}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
            >
              {PERCENTS.map((p) => (
                <option key={p} value={p}>
                  {p}%
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-foreground font-medium">Vale por</span>
            <select
              className={selectClass}
              value={validDays}
              onChange={(e) => setValidDays(Number(e.target.value))}
            >
              {VALIDITY.map((d) => (
                <option key={d} value={d}>
                  {d} dias
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Estadias a partir de (opcional)"
            type="date"
            value={stayFrom}
            onChange={(e) => setStayFrom(e.target.value)}
          />
          <Input
            label="Até (opcional)"
            type="date"
            value={stayUntil}
            onChange={(e) => setStayUntil(e.target.value)}
          />
        </div>
        <label className="mt-3 flex flex-col gap-1.5 text-sm">
          <span className="text-foreground font-medium">Recado (opcional)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Ex.: A temporada das cachoeiras começou. Venha ver de novo!"
            className="border-input bg-card text-foreground focus:border-ring resize-none rounded-xl border px-3.5 py-2.5 text-sm outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-destructive mt-3 text-sm font-medium">
            {error}
          </p>
        )}
      </Dialog>
    </Card>
  )
}
