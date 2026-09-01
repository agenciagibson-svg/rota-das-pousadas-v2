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
            <h2 id={titleId} className="font-serif text-xl font-semibold text-foreground">
              {title}
            </h2>
          )}
          {description && (
            <p id={descId} className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>
      {children && <div className="mt-4">{children}</div>}
      {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
    </Modal>
  )
}
