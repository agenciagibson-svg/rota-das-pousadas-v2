'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * "Copiar link do pré-check-in" (0088) — para a recepção mandar pelo WhatsApp.
 * Sem permissão de área de transferência (navegador antigo, sem HTTPS), mostra
 * o link num campo já selecionado para copiar à mão.
 */
export function CopyPrecheckinLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState(false)

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('sem área de transferência')
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setManual(true)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="pill" className="self-start" onClick={copy}>
        {copied ? <Check className="text-primary size-4" /> : <Copy className="size-4" />}
        {copied ? 'Link copiado' : 'Copiar link do pré-check-in'}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Link copiado' : ''}
      </span>
      {manual && (
        <Input
          id="precheckin-link"
          readOnly
          autoFocus
          value={url}
          aria-label="Link do pré-check-in"
          hint="Não deu para copiar sozinho. O link está selecionado: copie e cole na conversa."
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </div>
  )
}
