import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
  iconStart?: ReactNode
  iconEnd?: ReactNode
  wrapperClassName?: string
}

/**
 * Text input with optional label, hint, error and inline icons.
 * Focus ring and invalid styling follow the same tokens as `Button`.
 */
export function Input({
  className,
  wrapperClassName,
  label,
  hint,
  error,
  iconStart,
  iconEnd,
  id,
  name,
  ...props
}: InputProps) {
  const inputId = id ?? name
  const describedBy = hint || error ? `${inputId}-desc` : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border border-input bg-card px-3.5 py-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20',
          error && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/20',
        )}
      >
        {iconStart && <span className="shrink-0 text-muted-foreground">{iconStart}</span>}
        <input
          id={inputId}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70',
            className,
          )}
          {...props}
        />
        {iconEnd && <span className="shrink-0 text-muted-foreground">{iconEnd}</span>}
      </div>
      {(hint || error) && (
        <p id={describedBy} className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
