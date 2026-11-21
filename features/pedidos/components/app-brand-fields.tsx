'use client'

import Image from 'next/image'
import { Check, Home, KeyRound } from 'lucide-react'
import { ImageUpload } from '@/components/ui/image-upload'
import { APP_ACCENTS, type AppAccent } from '@/features/app-fases/brand'
import { cn } from '@/lib/utils'

type Brand = { appLogoUrl: string; appCoverUrl: string; appAccent: AppAccent | '' }

/**
 * Cara da pousada no app da estadia (0110): logo, capa e cor, com uma prévia
 * do topo do app. Tudo opcional — o app funciona sem nada configurado.
 */
export function AppBrandFields({
  value,
  onChange,
  pousadaId,
}: {
  value: Brand
  onChange: (next: Brand) => void
  pousadaId?: string
}) {
  const folder = pousadaId ? `${pousadaId}/app` : undefined
  const accent = APP_ACCENTS[value.appAccent || 'ipe'].hex

  return (
    <fieldset className="border-border space-y-3 border-b pb-4">
      <legend className="text-foreground text-sm font-semibold">Cara do app</legend>
      <p className="text-muted-foreground -mt-1 text-xs">
        Durante a estadia, o app mostra o logo, a capa e a cor da sua pousada. Sem capa, usamos a
        foto principal da pousada.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ImageUpload
          label="Logo"
          hint="PNG com fundo transparente fica melhor."
          value={value.appLogoUrl ? [value.appLogoUrl] : []}
          onChange={(urls) => onChange({ ...value, appLogoUrl: urls[0] ?? '' })}
          max={1}
          folder={folder}
          coverBadge={false}
        />
        <ImageUpload
          label="Capa (opcional)"
          hint="Foto na horizontal."
          value={value.appCoverUrl ? [value.appCoverUrl] : []}
          onChange={(urls) => onChange({ ...value, appCoverUrl: urls[0] ?? '' })}
          max={1}
          folder={folder}
          coverBadge={false}
        />
      </div>

      <div role="radiogroup" aria-label="Cor do app" className="space-y-1.5">
        <span className="text-foreground text-sm font-medium">Cor</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(APP_ACCENTS) as AppAccent[]).map((key) => {
            const selected = (value.appAccent || 'ipe') === key
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={APP_ACCENTS[key].label}
                title={APP_ACCENTS[key].label}
                onClick={() => onChange({ ...value, appAccent: key === 'ipe' ? '' : key })}
                className={cn(
                  'ring-offset-card grid size-10 place-items-center rounded-full transition',
                  selected ? 'ring-foreground ring-2 ring-offset-2' : 'hover:scale-105',
                )}
                style={{ background: APP_ACCENTS[key].hex }}
              >
                {selected && <Check className="text-breu size-4" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Prévia do topo do app, com o que está escolhido agora. */}
      <div className="bg-neblina rounded-2xl p-3" aria-hidden>
        <div className="flex items-center gap-2">
          {value.appLogoUrl ? (
            <span className="relative size-9 shrink-0 overflow-hidden rounded-full bg-white">
              <Image
                src={value.appLogoUrl}
                alt=""
                fill
                sizes="36px"
                className="object-contain p-1"
              />
            </span>
          ) : (
            <span className="bg-breu text-neblina grid size-9 place-items-center rounded-full">
              <Home className="size-4" />
            </span>
          )}
          <span className="text-breu text-xs font-semibold">Prévia no app</span>
        </div>
        <div className="bg-breu relative mt-2 flex items-center justify-between overflow-hidden rounded-2xl p-3">
          {value.appCoverUrl && (
            <>
              <Image src={value.appCoverUrl} alt="" fill sizes="360px" className="object-cover" />
              <span className="from-breu/95 via-breu/75 to-breu/35 absolute inset-0 bg-gradient-to-r" />
            </>
          )}
          <span className="text-neblina relative text-sm font-medium">Sua estadia</span>
          <span
            className="relative grid size-10 place-items-center rounded-full"
            style={{ background: accent }}
          >
            <KeyRound className="text-breu size-4" />
          </span>
        </div>
      </div>
    </fieldset>
  )
}
