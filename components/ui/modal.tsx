'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/**
 * Low-level overlay primitive: backdrop + centered panel, rendered in a portal.
 * Handles Escape-to-close and body scroll lock. `Dialog` builds on top of this;
 * use `Modal` directly only when you need full control of the panel contents.
 */
export function Modal({
  open,
  onClose,
  children,
  className,
  labelledBy,
  describedBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  labelledBy?: string
  describedBy?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      <div className="absolute inset-0 bg-stone-deep/50 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div className={cn('relative z-10 w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl shadow-stone-deep/20', className)}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
