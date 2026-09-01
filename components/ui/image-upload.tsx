'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export type ImageUploadProps = {
  value: string[]
  onChange: (urls: string[]) => void
  label?: string
  hint?: string
  error?: string
  /** Bucket público do Storage; policy de insert restringe quem pode subir. */
  bucket?: string
  max?: number
}

/**
 * Upload de imagens direto do navegador para o Supabase Storage (bucket
 * público). A primeira foto da lista é usada como capa da pousada.
 */
export function ImageUpload({
  value,
  onChange,
  label,
  hint,
  error,
  bucket = 'pousadas',
  max = 12,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadError(null)
    setUploading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const uploaded: string[] = []
      for (const file of Array.from(files).slice(0, Math.max(0, max - value.length))) {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (uploadErr) throw uploadErr
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }
      onChange([...value, ...uploaded])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  const describedBy = hint || error || uploadError ? 'image-upload-desc' : undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      )}

      <div className="flex flex-wrap gap-3">
        {value.map((url, index) => (
          <div key={url} className="group relative size-24 overflow-hidden rounded-xl border border-border">
            <Image src={url} alt="" fill sizes="96px" className="object-cover" />
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label="Remover foto"
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
            {index === 0 && (
              <span className="absolute bottom-1 left-1 rounded-full bg-foreground/70 px-2 py-0.5 text-[10px] font-semibold text-background">
                Capa
              </span>
            )}
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-describedby={describedBy}
            className={cn(
              'flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-input text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:opacity-50',
              error && 'border-destructive text-destructive',
            )}
          >
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            <span className="text-[11px]">{uploading ? 'Enviando…' : 'Adicionar'}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {(hint || error || uploadError) && (
        <p id={describedBy} className={cn('text-xs', error || uploadError ? 'text-destructive' : 'text-muted-foreground')}>
          {uploadError ?? error ?? hint}
        </p>
      )}
    </div>
  )
}
