'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, ExternalLink, FileText, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { reviewPaymentProofAction } from '../actions'
import { parseBRL } from '../pix'

export type ProofForReview = {
  id: string
  status: 'submitted' | 'approved' | 'rejected'
  fileName: string
  createdAt: string
  rejectionReason: string | null
  amount: number
  approvedAmount?: number | null
  mimeType: string
  reviewedAt: string | null
  url: string | null
}

const STATUS: Record<
  ProofForReview['status'],
  { label: string; variant: 'goldSoft' | 'primarySoft' | 'destructiveSoft' }
> = {
  submitted: { label: 'Aguardando aprovação', variant: 'goldSoft' },
  approved: { label: 'Aprovado', variant: 'primarySoft' },
  rejected: { label: 'Recusado', variant: 'destructiveSoft' },
}

function when(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Comprovantes de Pix direto da reserva: a equipe confere o arquivo e aprova/recusa. */
function formatInput(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ProofReviewPanel({
  proofs,
  canReview,
  dueAt = null,
}: {
  proofs: ProofForReview[]
  canReview: boolean
  /** Até quando as datas ficam guardadas enquanto o comprovante está em análise. */
  dueAt?: string | null
}) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [received, setReceived] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const typed = (p: ProofForReview) => received[p.id] ?? formatInput(p.amount)

  async function decide(proof: ProofForReview, approve: boolean) {
    setError(null)
    let amount: number | undefined
    if (approve) {
      const parsed = parseBRL(typed(proof))
      if (parsed === null) {
        setError('Informe o valor que entrou na conta da pousada.')
        return
      }
      if (parsed > proof.amount) {
        setError(
          `O valor é maior que o saldo da reserva (${brl(proof.amount)}). Aprove o saldo e combine a devolução do excedente com o hóspede.`,
        )
        return
      }
      amount = parsed
    }
    setBusy(true)
    try {
      const result = await reviewPaymentProofAction({
        proofId: proof.id,
        approve,
        reason: approve ? '' : reason,
        ...(amount !== undefined ? { amount } : {}),
      })
      if (!result.ok) {
        setError(result.fieldErrors?.reason ?? result.fieldErrors?.amount ?? result.error)
        return
      }
      setRejecting(null)
      setReason('')
      router.refresh()
    } catch {
      setError('Não foi possível salvar agora. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {proofs.map((p) => {
        const s = STATUS[p.status]
        const isImage =
          p.mimeType.startsWith('image/') &&
          !p.mimeType.includes('heic') &&
          !p.mimeType.includes('heif')
        return (
          <div key={p.id} className="border-border rounded-2xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant={s.variant} size="sm">
                  {s.label}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  Enviado em {when(p.createdAt)} · valor esperado {brl(p.amount)}
                </span>
              </div>
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                >
                  <ExternalLink className="size-3.5" /> Abrir arquivo
                </a>
              )}
            </div>

            {p.url && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- link assinado temporário do Storage
              <img
                src={p.url}
                alt={`Comprovante ${p.fileName}`}
                className="border-border mt-3 max-h-96 w-auto rounded-xl border object-contain"
              />
            ) : (
              <p className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
                <FileText className="size-4" /> {p.fileName || 'Comprovante'}
              </p>
            )}

            {p.status === 'approved' && p.approvedAmount != null && p.approvedAmount < p.amount && (
              <p className="text-muted-foreground mt-2 text-xs">
                Aprovado parcialmente: {brl(p.approvedAmount)} de {brl(p.amount)}.
              </p>
            )}

            {p.status === 'rejected' && p.rejectionReason && (
              <p className="text-muted-foreground mt-2 text-xs">Motivo: {p.rejectionReason}</p>
            )}

            {p.status === 'submitted' && canReview && (
              <div className="mt-4 space-y-3">
                {dueAt && (
                  <p className="bg-ipe/15 text-foreground flex items-start gap-2 rounded-xl px-3 py-2 text-sm">
                    <Clock className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Analise até <strong>{when(dueAt)}</strong>. Depois disso a reserva é cancelada
                      e o caso vai para &ldquo;Pagamentos para revisar&rdquo;.
                    </span>
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  Confira no extrato da conta da pousada quanto entrou antes de aprovar. Saldo da
                  reserva: {brl(p.amount)}.
                </p>
                {rejecting !== p.id && (
                  <label className="block max-w-xs space-y-1">
                    <span className="text-sm font-medium">Valor que entrou na conta (R$)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={typed(p)}
                      onChange={(e) => setReceived((r) => ({ ...r, [p.id]: e.target.value }))}
                      className="border-input bg-card focus-visible:ring-ring h-11 w-full rounded-xl border px-3 text-base focus-visible:ring-2 focus-visible:outline-none"
                    />
                    {(() => {
                      const v = parseBRL(typed(p))
                      return v !== null && v < p.amount ? (
                        <span className="text-foreground block text-xs">
                          Pagamento parcial: a reserva continua aguardando {brl(p.amount - v)} e o
                          hóspede recebe um aviso para pagar o restante.
                        </span>
                      ) : null
                    })()}
                  </label>
                )}
                {rejecting === p.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={300}
                      rows={2}
                      aria-label="Motivo da recusa"
                      placeholder="Motivo para o hóspede (ex.: o valor não entrou na conta, comprovante ilegível)"
                      className="border-input bg-card w-full rounded-xl border px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void decide(p, false)}
                      >
                        Confirmar recusa
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setRejecting(null)}
                      >
                        Voltar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void decide(p, true)}
                    >
                      <CheckCircle2 className="size-4" />
                      {busy
                        ? 'Salvando…'
                        : (parseBRL(typed(p)) ?? p.amount) < p.amount
                          ? 'Aprovar valor parcial'
                          : 'Aprovar pagamento e confirmar reserva'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setRejecting(p.id)}
                    >
                      <XCircle className="size-4" />
                      Recusar
                    </Button>
                  </div>
                )}
                {error && <p className="text-destructive text-sm font-medium">{error}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
