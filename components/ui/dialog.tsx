'use client'

import { useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Modal } from './modal'

/**
 * Titled dialog: header (title + description + close), body and optional footer.
 * The accessible name/description are wired to the underlying Modal.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const titleId = useId()
  const descId = useId()
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={title ? titleId : undefined}
      describedBy={description ? descId : undefined}
      className={className}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {title && (
            <h2 id={titleId} className="font-display text-foreground text-xl font-medium">
              {title}
            </h2>
          )}
          {description && (
            <p id={descId} className="text-muted-foreground mt-1 text-sm">
              {description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <X className="size-5" />
        </button>
      </div>
      {children && <div className="mt-4">{children}</div>}
      {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
    </Modal>
  )
}
