'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { cn } from '@/lib/utils'

/**
 * Low-level overlay primitive: backdrop + centered panel, rendered in a portal.
 * Handles Escape-to-close, body scroll lock and focus (in, trapped, restored). `Dialog` builds on top of this;
 * use `Modal` directly only when you need full control of the panel contents.
 */
export function Modal({
  open,
  onClose,
  children,
  className,
  labelledBy,
  label,
  describedBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  labelledBy?: string
  /** Nome da janela quando não há um título visível para `labelledBy`. */
  label?: string
  describedBy?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open && mounted)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    // O overlay rola: janela mais alta que a tela (ex.: editar acomodação)
    // não pode cortar o título nem o botão de salvar.
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      aria-describedby={describedBy}
    >
      <div
        className="bg-stone-deep/50 fixed inset-0 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="relative flex min-h-full items-center justify-center p-4 sm:p-6"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className={cn(
            'border-border bg-card shadow-stone-deep/20 relative z-10 w-full max-w-lg rounded-3xl border p-6 shadow-2xl',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
