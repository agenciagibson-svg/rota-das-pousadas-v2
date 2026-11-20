'use client'

import { useEffect, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Campo de foto da dica: escolhe a imagem e mostra a miniatura. A redução e a
 * conversão para JPEG acontecem no envio (`resizePhoto`).
 */
export function TipPhotoField({
  onChange,
  error,
}: {
  onChange: (file: File | null) => void
  error?: string
}) {
  const [preview, setPreview] = useState<string | null>(null)

  // Libera a prévia (blob:) ao trocar de foto e ao sair da tela.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  function choose(next: File | null) {
    setPreview(next ? URL.createObjectURL(next) : null)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-foreground text-sm font-medium">Foto (opcional)</span>
      {preview ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) */}
          <img
            src={preview}
            alt="Prévia da foto escolhida"
            className="size-20 rounded-2xl object-cover"
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => choose(null)}>
            <X className="size-4" aria-hidden />
            Tirar foto
          </Button>
        </div>
      ) : (
        <label className="border-border text-muted-foreground hover:bg-muted flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold">
          <ImagePlus className="size-4" aria-hidden />
          Escolher foto
          <input
            id="dica-photo"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
      <span className="text-muted-foreground text-xs">
        Só fotos suas. Antes de enviar, a foto é reduzida e perde a localização de onde foi tirada.
      </span>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  )
}
