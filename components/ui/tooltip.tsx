'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const sideMap = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
} as const

/**
 * Lightweight tooltip driven by hover + keyboard focus (accessible).
 * Wrap any focusable trigger; content is announced via aria-describedby.
 */
export function Tooltip({
  content,
  side = 'top',
  children,
  className,
}: {
  content: ReactNode
  side?: keyof typeof sideMap
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute z-[80] w-max max-w-xs rounded-lg bg-stone-deep px-2.5 py-1.5 text-xs font-medium text-linen shadow-lg',
            sideMap[side],
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
