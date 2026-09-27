'use client'

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

/** Paleta do app da estadia (cinza claro, preto e o laranja da marca). */
export const APP_BG = 'bg-[#f4f4f2]'

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
    dark ? 'bg-[#1e1e1e] text-white' : 'bg-white text-[#1e1e1e]',
    className,
  )
  const inner = (
    <>
      {children}
      {badge ? (
        <span className="bg-sunset absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-[#f4f4f2] px-1 text-[10px] font-extrabold text-white">
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

/** Título em dois tons: parte forte em preto, o resto em cinza claro. */
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
    <Tag className={cx('tracking-[-0.035em]', className)}>
      <span className="font-extrabold text-[#1e1e1e]">{strong}</span>
      {light ? <span className="font-normal text-[#b3b3ae]"> {light}</span> : null}
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
      <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[#1e1e1e]">{title}</h2>
      {action && onAction ? (
        <button type="button" onClick={onAction} className="text-[12.5px] text-[#9a9a96]">
          {action} ›
        </button>
      ) : aside ? (
        <span className="text-xs text-[#9a9a96]">{aside}</span>
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
        tone === 'dark' && 'bg-[#1e1e1e] text-white',
        tone === 'white' && 'bg-white text-[#1e1e1e]',
        tone === 'gray' && 'bg-[#2e2e2c] text-[#e5e5e2]',
        tone === 'orange' && 'bg-sunset text-white',
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
      className="relative shrink-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_40%,#ffffff,#ebebe8)] shadow-[inset_0_0_0_1px_#e2e2de]"
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <Image src={photoUrl} alt={alt} fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[#c9c9c4]">
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

/** Folha que sobe por cima do app (detalhe do item, sacola). */
export function Sheet({
  open,
  children,
  label,
}: {
  open: boolean
  children: React.ReactNode
  label: string
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-hidden={!open}
      className={cx(
        'fixed inset-0 z-40 overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
        APP_BG,
        open ? 'translate-y-0' : 'pointer-events-none translate-y-full',
      )}
    >
      <div className="mx-auto max-w-lg px-[18px] pt-[max(16px,env(safe-area-inset-top))] pb-40">
        {children}
      </div>
    </div>
  )
}
