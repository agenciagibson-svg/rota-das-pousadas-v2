import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: string
  wrapperClassName?: string
}

/** Área de texto multilinha — mesma linguagem visual do Input. */
export function Textarea({
  className,
  wrapperClassName,
  label,
  hint,
  error,
  id,
  name,
  rows = 4,
  ...props
}: TextareaProps) {
  const fieldId = id ?? name
  const describedBy = hint || error ? `${fieldId}-desc` : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label htmlFor={fieldId} className="text-foreground text-sm font-medium">
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'border-input bg-card text-foreground placeholder:text-muted-foreground focus:border-foreground focus:ring-ipe/60 rounded-2xl border px-4 py-3 text-sm transition-colors duration-(--motion-hover) outline-none focus:ring-2',
          error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
          className,
        )}
        {...props}
      />
      {(hint || error) && (
        <p
          id={describedBy}
          className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
