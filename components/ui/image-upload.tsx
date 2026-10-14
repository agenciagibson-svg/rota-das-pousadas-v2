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
  /** Pasta dentro do bucket (ex.: id da pousada — a policy só deixa o dono subir na dele). */
  folder?: string
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_BYTES = 10 * 1024 * 1024

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
  folder,
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
        if (!ACCEPTED.includes(file.type)) {
          throw new Error(`"${file.name}": envie foto em JPG, PNG ou WEBP.`)
        }
        if (file.size > MAX_BYTES) {
          throw new Error(`"${file.name}" tem mais de 10 MB. Reduza a foto e tente de novo.`)
        }
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
        const path = `${folder ? `${folder}/` : ''}${crypto.randomUUID()}.${ext || 'jpg'}`
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
      const msg = err instanceof Error ? err.message : ''
      // Mensagens do Storage vêm em inglês; traduz as que a pessoa pode resolver.
      setUploadError(
        msg.startsWith('"')
          ? msg
          : /row-level security|unauthorized|403/i.test(msg)
            ? 'Seu perfil não pode enviar fotos desta pousada.'
            : /size|large/i.test(msg)
              ? 'Foto muito grande (máximo 10 MB).'
              : 'Não foi possível enviar a foto. Verifique a internet e tente de novo.',
      )
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function makeCover(index: number) {
    if (index === 0) return
    const next = [...value]
    const [picked] = next.splice(index, 1)
    onChange([picked!, ...next])
  }

  const describedBy = hint || error || uploadError ? 'image-upload-desc' : undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-foreground text-sm font-medium">{label}</span>}

      <div className="flex flex-wrap gap-3">
        {value.map((url, index) => (
          <div
            key={url}
            className="group border-border relative size-24 overflow-hidden rounded-xl border"
          >
            <Image src={url} alt="" fill sizes="96px" className="object-cover" />
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label="Remover foto"
              className="bg-foreground/70 text-background absolute top-1 right-1 flex size-6 items-center justify-center rounded-full transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            >
              <X className="size-3.5" />
            </button>
            {index > 0 && (
              <button
                type="button"
                onClick={() => makeCover(index)}
                className="bg-foreground/70 text-background absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
              >
                Tornar capa
              </button>
            )}
            {index === 0 && (
              <span className="bg-foreground/70 text-background absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
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
              'border-input text-muted-foreground hover:border-ring hover:text-foreground flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed transition-colors disabled:opacity-50',
              error && 'border-destructive text-destructive',
            )}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            <span className="text-[11px]">{uploading ? 'Enviando…' : 'Adicionar'}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {(hint || error || uploadError) && (
        <p
          id={describedBy}
          className={cn(
            'text-xs',
            error || uploadError ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {uploadError ?? error ?? hint}
        </p>
      )}
    </div>
  )
}
