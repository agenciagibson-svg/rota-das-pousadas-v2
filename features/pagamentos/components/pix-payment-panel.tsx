'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock3, Copy, FileUp, Loader2, QrCode, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { submitPaymentProofAction } from '../actions'
import {
  PROOF_MAX_BYTES,
  PROOF_MIME_TYPES,
  displayPixKey,
  proofObjectPath,
  PIX_KEY_TYPE_LABEL,
} from '../pix'
import type { PixKeyType } from '@/lib/pix/brcode'

type ProofSummary = {
  id: string
  status: 'submitted' | 'approved' | 'rejected'
  fileName: string
  createdAt: string
  rejectionReason: string | null
}

export type PixPanelData = {
  available: boolean
  copiaECola: string | null
  qrSvg: string | null
  keyType: PixKeyType | null
  pixKey: string | null
  holderName: string | null
  amount: number
  lastProof: ProofSummary | null
}

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Pix direto para a conta da pousada: QR Code + copia e cola com o valor exato
 * e o código da reserva, e envio do comprovante. Depois do envio a reserva
 * fica "aguardando aprovação" até a equipe da pousada conferir.
 */
export function PixPaymentPanel({
  bookingId,
  bookingCode,
  pix,
  canPay,
}: {
  bookingId: string
  bookingCode: string
  pix: PixPanelData
  /** Reserva pendente, com saldo e dentro do prazo. */
  canPay: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSent, setJustSent] = useState(false)

  const proof = pix.lastProof
  const awaiting = justSent || proof?.status === 'submitted'
  const rejected = !awaiting && proof?.status === 'rejected'
  // Pousada aprovou só parte (0082): ainda há saldo, então o QR é do restante.
  const partial = !awaiting && proof?.status === 'approved' && pix.amount > 0

  async function copy() {
    if (!pix.copiaECola) return
    try {
      await navigator.clipboard.writeText(pix.copiaECola)
    } catch {
      const area = document.createElement('textarea')
      area.value = pix.copiaECola
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!(PROOF_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError('Envie uma foto (JPG, PNG) ou o PDF do comprovante.')
      return
    }
    if (file.size > PROOF_MAX_BYTES) {
      setError('Arquivo muito grande (máximo 10 MB).')
      return
    }
    setUploading(true)
    try {
      const path = proofObjectPath(bookingId, file.name, crypto.randomUUID())
      const supabase = createSupabaseBrowserClient()
      const { error: upErr } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error('Não foi possível enviar o arquivo. Tente de novo.')
      const result = await submitPaymentProofAction({
        bookingId,
        filePath: path,
        fileName: file.name.slice(0, 150),
        mimeType: file.type as (typeof PROOF_MIME_TYPES)[number],
        sizeBytes: file.size,
      })
      if (!result.ok) throw new Error(result.error)
      setJustSent(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar o comprovante.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (awaiting) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950"
      >
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 size-5 shrink-0 text-sky-600" />
          <div>
            <p className="font-semibold">Comprovante enviado — aguardando aprovação da pousada</p>
            <p className="mt-1">
              A pousada vai conferir o Pix na conta dela e confirmar a sua reserva. Você recebe um
              e-mail assim que isso acontecer. Suas datas continuam guardadas.
            </p>
            {proof?.fileName && !justSent && (
              <p className="mt-2 text-xs text-sky-900/70">Arquivo: {proof.fileName}</p>
            )}
          </div>
        </div>
        {canPay && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 text-xs font-semibold text-sky-800 underline"
            disabled={uploading}
          >
            {uploading ? 'Enviando…' : 'Enviei o arquivo errado — trocar comprovante'}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={PROOF_MIME_TYPES.join(',')}
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {error && <p className="text-destructive mt-2 text-sm font-medium">{error}</p>}
      </div>
    )
  }

  if (!pix.available || !canPay || !pix.copiaECola || !pix.qrSvg) return null

  return (
    <div className="min-w-0 rounded-2xl border-2 border-emerald-500/60 bg-emerald-50/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-emerald-950">
          <QrCode className="size-5 text-emerald-600" />
          Pagar com Pix
        </p>
        <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
          Recomendado
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        Direto na conta da pousada, na hora. Abra o app do seu banco e escaneie o QR Code ou use o
        copia e cola.
      </p>

      {rejected && proof?.rejectionReason && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          <XCircle className="mt-0.5 size-4 shrink-0 text-orange-600" />
          <p>
            <strong>A pousada não confirmou o comprovante anterior:</strong>{' '}
            {proof.rejectionReason.replace(/[.\s]+$/, '')}. Envie outro comprovante ou pague de
            novo.
          </p>
        </div>
      )}

      {partial && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>A pousada confirmou parte do pagamento.</strong> Falta pagar {brl(pix.amount)}{' '}
          para confirmar a reserva. Depois, envie o novo comprovante aqui.
        </p>
      )}

      <div className="mt-4 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
        <div
          className="mx-auto w-44 rounded-xl border border-emerald-200 bg-white p-2 sm:w-full"
          aria-label="QR Code do Pix"
          role="img"
          // SVG gerado no servidor pela biblioteca de QR Code a partir do copia e cola.
          dangerouslySetInnerHTML={{ __html: pix.qrSvg }}
        />
        <div className="min-w-0 space-y-2 text-sm">
          <p className="text-foreground text-2xl font-semibold">{brl(pix.amount)}</p>
          <p className="text-muted-foreground">
            Para: <strong className="text-foreground">{pix.holderName}</strong>
          </p>
          {pix.keyType && pix.pixKey && (
            <p className="text-muted-foreground">
              Chave {PIX_KEY_TYPE_LABEL[pix.keyType]}: {displayPixKey(pix.keyType, pix.pixKey)}
            </p>
          )}
          <p className="text-muted-foreground text-xs">Identificação: {bookingCode}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase">
          Pix copia e cola
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={pix.copiaECola}
            onFocus={(e) => e.currentTarget.select()}
            className="border-input bg-card min-w-0 flex-1 truncate rounded-xl border px-3 py-2.5 font-mono text-xs"
            aria-label="Código Pix copia e cola"
          />
          <Button type="button" onClick={() => void copy()} className="shrink-0">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
        </div>
      </div>

      <div className="mt-5 border-t border-emerald-200 pt-4">
        <p className="text-sm font-semibold">Já pagou? Envie o comprovante</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Foto ou print da tela do banco, ou o PDF. A pousada confere e confirma a reserva.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={PROOF_MIME_TYPES.join(',')}
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {uploading ? 'Enviando comprovante…' : 'Enviar comprovante do Pix'}
        </Button>
        {error && <p className="text-destructive mt-2 text-sm font-medium">{error}</p>}
      </div>
    </div>
  )
}
