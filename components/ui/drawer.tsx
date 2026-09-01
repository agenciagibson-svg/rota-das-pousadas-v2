'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const panelBySide = {
  right: 'right-0 top-0 h-full w-full max-w-sm',
  left: 'left-0 top-0 h-full w-full max-w-sm',
  top: 'left-0 top-0 h-auto max-h-[85vh] w-full',
  bottom: 'bottom-0 left-0 h-auto max-h-[85vh] w-full',
} as const

const roundBySide = {
  right: 'rounded-l-3xl',
  left: 'rounded-r-3xl',
  top: 'rounded-b-3xl',
  bottom: 'rounded-t-3xl',
} as const

/** Slide-in panel anchored to any edge. Portal + Escape + scroll lock. */
export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  side?: keyof typeof panelBySide
  title?: string
  children: ReactNode
  className?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-stone-deep/40 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div className={cn('absolute border-border bg-card p-6 shadow-2xl shadow-stone-deep/20', panelBySide[side], roundBySide[side], className)}>
        <div className="flex items-center justify-between">
          {title ? <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2> : <span />}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-4 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
