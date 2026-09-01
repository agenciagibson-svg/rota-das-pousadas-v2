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
        <label
          htmlFor={fieldId}
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
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
          'rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-3 focus:ring-ring/20',
          error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
          className,
        )}
        {...props}
      />
      {(hint || error) && (
        <p id={describedBy} className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
