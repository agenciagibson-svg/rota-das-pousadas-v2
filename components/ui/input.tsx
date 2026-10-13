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
        <label htmlFor={inputId} className="text-foreground text-sm font-medium">
          {label}
        </label>
      )}
      <div
        className={cn(
          'border-input bg-card focus-within:border-foreground focus-within:ring-ipe/60 flex min-h-12 items-center gap-2 rounded-2xl border px-4 transition-colors duration-(--motion-hover) focus-within:ring-2',
          error &&
            'border-destructive focus-within:border-destructive focus-within:ring-destructive/20',
        )}
      >
        {iconStart && <span className="text-muted-foreground shrink-0">{iconStart}</span>}
        <input
          id={inputId}
          name={name}
          // E-mail não passa pelo corretor ortográfico (Web Interface Guidelines).
          spellCheck={props.type === 'email' ? false : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'text-foreground placeholder:text-muted-foreground w-full bg-transparent py-2.5 text-sm outline-none',
            className,
          )}
          {...props}
        />
        {iconEnd && <span className="text-muted-foreground shrink-0">{iconEnd}</span>}
      </div>
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
