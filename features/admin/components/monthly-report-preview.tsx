'use client'

import { useState, useTransition } from 'react'
import { CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { previewMonthlyReportAction } from '../maintenance-actions'

type PousadaOption = { id: string; name: string; status: string }

/**
 * Prévia do "Relatório do mês" (0097): manda o e-mail de UMA pousada só para
 * quem clicou, para conferir o layout em produção. Não marca como enviado — a
 * pousada continua recebendo o relatório normal no dia 1º.
 */
export function MonthlyReportPreview({ pousadas }: { pousadas: PousadaOption[] }) {
  const [pending, start] = useTransition()
  const [pousadaId, setPousadaId] = useState(pousadas[0]?.id ?? '')
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  function send() {
    setMessage(null)
    start(async () => {
      const result = await previewMonthlyReportAction({ pousadaId })
      if (!result.ok) {
        setMessage({ tone: 'warn', text: result.error })
        return
      }
      const r = result.data
      if (r.status === 'enviado') {
        setMessage({
          tone: 'ok',
          text: `Prévia de ${r.monthLabel} enviada para ${r.to}. Confira a caixa de entrada (e o spam).`,
        })
      } else if (r.status === 'sem-config') {
        setMessage({
          tone: 'warn',
          text: 'O envio de e-mail não está configurado na Vercel (faltam SMTP_USER/SMTP_PASS).',
        })
      } else {
        setMessage({
          tone: 'warn',
          text: `O servidor de e-mail (${r.host}) recusou o envio (código ${r.code}).`,
        })
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-foreground font-semibold">Relatório do mês</h2>
        <p className="text-muted-foreground text-sm">
          Todo dia 1º o proprietário e o gestor de cada pousada publicada recebem o resumo do mês
          anterior. Aqui você manda o relatório de uma pousada só para você, para conferir. Nada é
          marcado como enviado.
        </p>
      </div>
      {pousadas.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma pousada cadastrada ainda.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-foreground text-sm font-medium">Pousada</span>
            <select
              value={pousadaId}
              onChange={(e) => setPousadaId(e.target.value)}
              disabled={pending}
              className="border-input bg-card text-foreground focus:border-ring h-10 max-w-xs rounded-xl border px-3 text-sm outline-none"
            >
              {pousadas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.status === 'publicada' ? p.name : `${p.name} (${p.status})`}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" onClick={send} disabled={pending || !pousadaId}>
            <CalendarRange className="size-4" />
            {pending ? 'Enviando…' : 'Enviar relatório do mês para mim (prévia)'}
          </Button>
        </div>
      )}
      {message && (
        <p
          role="status"
          className={
            message.tone === 'ok'
              ? 'text-success text-sm font-medium'
              : 'text-destructive text-sm font-medium'
          }
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
