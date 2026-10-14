import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SearchFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode
  label: string
  /** `dark`: sobre vidro escuro (barra de busca do hero). `light`: em folha ou cartão claro. */
  tone?: 'light' | 'dark'
}

/**
 * Campo rotulado da busca: rótulo pequeno em cima, valor grande embaixo, sem
 * ícone por campo. O foco aparece no contorno do campo inteiro (anel Ipê),
 * já que o input em si não tem borda.
 */
export function SearchField({
  icon,
  label,
  tone = 'light',
  className,
  id,
  name,
  ...props
}: SearchFieldProps) {
  const inputId = id ?? name
  const dark = tone === 'dark'
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'focus-within:ring-ipe flex min-h-14 min-w-0 cursor-text items-center gap-3 rounded-3xl px-4 py-2 transition-colors duration-(--motion-hover) focus-within:ring-2',
        dark ? 'hover:bg-primary-foreground/10' : 'bg-secondary hover:bg-muted',
      )}
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn('text-xs font-semibold', dark ? 'text-liquen' : 'text-muted-foreground')}
        >
          {label}
        </span>
        <input
          id={inputId}
          name={name}
          className={cn(
            'w-full min-w-0 bg-transparent text-base font-medium outline-none',
            dark
              ? 'text-primary-foreground placeholder:text-primary-foreground/60 [color-scheme:dark]'
              : 'text-foreground placeholder:text-muted-foreground',
            className,
          )}
          {...props}
        />
      </span>
    </label>
  )
}
