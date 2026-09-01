'use client'

import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type AccordionCtx = {
  openItems: string[]
  toggle: (v: string) => void
  baseId: string
}
const AccordionContext = createContext<AccordionCtx | null>(null)
const ItemContext = createContext<string | null>(null)

export function Accordion({
  type = 'single',
  defaultValue,
  className,
  children,
}: {
  type?: 'single' | 'multiple'
  defaultValue?: string | string[]
  className?: string
  children: ReactNode
}) {
  const [openItems, setOpenItems] = useState<string[]>(
    defaultValue ? (Array.isArray(defaultValue) ? defaultValue : [defaultValue]) : [],
  )
  const baseId = useId()
  const toggle = (v: string) =>
    setOpenItems((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : type === 'single' ? [v] : [...prev, v],
    )
  return (
    <AccordionContext.Provider value={{ openItems, toggle, baseId }}>
      <div className={cn('divide-y divide-border', className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

export function AccordionItem({ value, children }: { value: string; children: ReactNode }) {
  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>
}

export function AccordionTrigger({ children, className }: { children: ReactNode; className?: string }) {
  const ctx = useContext(AccordionContext)
  const value = useContext(ItemContext)
  if (!ctx || value == null) throw new Error('AccordionTrigger must be inside Accordion > AccordionItem')
  const open = ctx.openItems.includes(value)
  return (
    <h3>
      <button
        id={`${ctx.baseId}-trigger-${value}`}
        aria-expanded={open}
        aria-controls={`${ctx.baseId}-content-${value}`}
        onClick={() => ctx.toggle(value)}
        className={cn(
          'flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-semibold text-foreground',
          className,
        )}
      >
        {children}
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
    </h3>
  )
}

export function AccordionContent({ children, className }: { children: ReactNode; className?: string }) {
  const ctx = useContext(AccordionContext)
  const value = useContext(ItemContext)
  if (!ctx || value == null) throw new Error('AccordionContent must be inside Accordion > AccordionItem')
  const open = ctx.openItems.includes(value)
  if (!open) return null
  return (
    <div
      id={`${ctx.baseId}-content-${value}`}
      role="region"
      aria-labelledby={`${ctx.baseId}-trigger-${value}`}
      className={cn('pb-4 text-sm leading-relaxed text-muted-foreground', className)}
    >
      {children}
    </div>
  )
}
