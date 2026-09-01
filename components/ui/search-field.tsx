import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SearchFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode
  label: string
}

/**
 * The labelled search field used in the hero search bar: a circular icon,
 * an uppercase caption and a borderless input, all inside a rounded card.
 * Extracted verbatim so the hero and any future search surface stay identical.
 */
export function SearchField({ icon, label, className, id, name, ...props }: SearchFieldProps) {
  const inputId = id ?? name
  return (
    <label
      htmlFor={inputId}
      className="flex cursor-text items-center gap-3 rounded-2xl bg-card px-4 py-2.5 transition-colors hover:bg-card/90"
    >
      {icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <input
          id={inputId}
          name={name}
          className={cn(
            'w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/70',
            className,
          )}
          {...props}
        />
      </span>
    </label>
  )
}
