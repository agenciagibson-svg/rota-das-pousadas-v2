'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  AirVent,
  AlarmClock,
  Bath,
  BedDouble,
  Check,
  ConciergeBell,
  Croissant,
  Droplets,
  Flame,
  GlassWater,
  Landmark,
  MapPin,
  Mountain,
  Package,
  Refrigerator,
  Sandwich,
  Shirt,
  ShowerHead,
  Sofa,
  Sparkles,
  SprayCan,
  Sun,
  Trees,
  Tv,
  UtensilsCrossed,
  Waves,
  Wifi,
  Wind,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { InventoryCategory } from '@/features/estoque/labels'
import { useFocusTrap } from '@/hooks/use-focus-trap'

/** Paleta do app da estadia: Neblina, Breu e o Ipê da marca (docs/Marca.md). */
export const APP_BG = 'bg-neblina'

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

/** Botão redondo (ícone). */
export function RoundButton({
  children,
  label,
  onClick,
  href,
  dark,
  className,
  badge,
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
  href?: string
  dark?: boolean
  className?: string
  badge?: number
}) {
  const cls = cx(
    'relative grid size-11 shrink-0 place-items-center rounded-full transition active:scale-95',
    dark ? 'bg-breu text-neblina' : 'bg-card text-breu',
    className,
  )
  const inner = (
    <>
      {children}
      {badge ? (
        <span className="bg-ipe border-neblina text-breu absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 px-1 text-[10px] font-bold">
          {badge}
        </span>
      ) : null}
    </>
  )
  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel="noopener noreferrer"
        aria-label={label}
        className={cls}
      >
        {inner}
      </a>
    )
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

/** Título em dois pesos (Funnel Display): parte forte em Breu, o resto leve em Grafite. */
export function TwoTone({
  strong,
  light,
  as: Tag = 'h1',
  className,
}: {
  strong: string
  light?: string
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  return (
    <Tag className={cx('font-display tracking-[-0.01em]', className)}>
      <span className="text-breu font-medium">{strong}</span>
      {light ? <span className="text-grafite font-light"> {light}</span> : null}
    </Tag>
  )
}

export function SectionHead({
  title,
  action,
  onAction,
  aside,
}: {
  title: string
  action?: string
  onAction?: () => void
  aside?: string
}) {
  return (
    <div className="mt-6 mb-3 flex items-center justify-between px-0.5">
      <h2 className="font-display text-breu text-[17px] font-medium">{title}</h2>
      {action && onAction ? (
        <button type="button" onClick={onAction} className="text-muted-foreground text-[12.5px]">
          {action} ›
        </button>
      ) : aside ? (
        <span className="text-muted-foreground text-xs">{aside}</span>
      ) : null}
    </div>
  )
}

export function Pill({
  children,
  tone = 'dark',
}: {
  children: React.ReactNode
  tone?: 'dark' | 'white' | 'gray' | 'orange'
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap',
        tone === 'dark' && 'bg-breu text-neblina',
        tone === 'white' && 'bg-card text-breu',
        tone === 'gray' && 'bg-neblina/10 text-neblina',
        tone === 'orange' && 'bg-ipe text-breu',
      )}
    >
      {children}
    </span>
  )
}

const CATEGORY_ICON: Partial<Record<InventoryCategory, LucideIcon>> = {
  bebidas: GlassWater,
  alimentos: Sandwich,
  frigobar: Refrigerator,
  cafe_da_manha: Croissant,
  enxoval: Shirt,
  amenities: Sparkles,
  limpeza: SprayCan,
  manutencao: Wrench,
  servicos: ConciergeBell,
}

export function categoryIcon(c: InventoryCategory): LucideIcon {
  return CATEGORY_ICON[c] ?? Package
}

/** Foto do item num "prato" redondo; sem foto, o ícone da categoria. */
export function ItemVisual({
  photoUrl,
  category,
  size,
  alt = '',
}: {
  photoUrl: string | null
  category: InventoryCategory
  size: number
  alt?: string
}) {
  const Icon = CATEGORY_ICON[category] ?? Package
  return (
    <div
      className="ring-border relative shrink-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_40%,var(--card),var(--secondary))] ring-1 ring-inset"
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <Image src={photoUrl} alt={alt} fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <div className="text-liquen absolute inset-0 grid place-items-center">
          <Icon style={{ width: size * 0.42, height: size * 0.42 }} strokeWidth={1.6} />
        </div>
      )}
    </div>
  )
}

/** Ícone para uma comodidade do quarto, pelo nome. */
export function amenityIcon(name: string): LucideIcon {
  const n = name.toLowerCase()
  if (/wi-?fi|internet/.test(n)) return Wifi
  if (/cama|king|queen|casal|solteiro/.test(n)) return BedDouble
  if (/lareira/.test(n)) return Flame
  if (/banheira|hidro|ofur/.test(n)) return Bath
  if (/chuveiro|ducha/.test(n)) return ShowerHead
  if (/tv|televis/.test(n)) return Tv
  if (/frigobar|geladeira/.test(n)) return Refrigerator
  if (/ar[- ]condicionado|climatiz/.test(n)) return AirVent
  if (/aquecedor|ventilador/.test(n)) return Wind
  if (/varanda|sacada|vista/.test(n)) return Sun
  if (/piscina/.test(n)) return Waves
  if (/sof[aá]|sala/.test(n)) return Sofa
  if (/caf[eé]|cafeteira/.test(n)) return Croissant
  return Check
}

/** Ícone para uma dica da região, pelo tipo. */
export function tipIcon(kind: string): LucideIcon {
  const k = kind.toLowerCase()
  if (/trilha|pico|mirante|montanha/.test(k)) return Mountain
  if (/restaurante|gastronomia|comida|bar|caf/.test(k)) return UtensilsCrossed
  if (/cachoeira|rio|lago|praia/.test(k)) return Droplets
  if (/parque|natureza|bosque/.test(k)) return Trees
  if (/museu|igreja|hist|centro|cultura/.test(k)) return Landmark
  return MapPin
}

/** Ícone para um pedido rápido (serviço), pelo nome. */
export function serviceIcon(name: string): LucideIcon {
  const n = name.toLowerCase()
  if (/toalha|len[çc]ol|roup/.test(n)) return Shirt
  if (/lenha|lareira/.test(n)) return Flame
  if (/arruma|limpe|faxina/.test(n)) return Sparkles
  if (/despert|acordar/.test(n)) return AlarmClock
  if (/caf[eé]/.test(n)) return Croissant
  return ConciergeBell
}

/**
 * Folha que sobe por cima do app (detalhe do item, sacola). Fechada, sai da
 * árvore de foco (`inert`); aberta, prende o foco e fecha no Esc. `footer`
 * fica preso ao pé da folha, dentro da janela (barra de quantidade/adicionar).
 */
export function Sheet({
  open,
  children,
  label,
  onClose,
  footer,
}: {
  open: boolean
  children: React.ReactNode
  label: string
  onClose?: () => void
  footer?: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open)
  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-hidden={!open}
      inert={!open}
      className={cx(
        'fixed inset-0 z-40 transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
        APP_BG,
        open ? 'translate-y-0' : 'pointer-events-none translate-y-full',
      )}
    >
      <div className="h-full overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-lg px-[18px] pt-[max(16px,env(safe-area-inset-top))] pb-40">
          {children}
        </div>
      </div>
      {footer}
    </div>
  )
}
