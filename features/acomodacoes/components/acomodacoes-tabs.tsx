import Link from 'next/link'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'inventario', label: 'Inventário', href: '/dashboard/acomodacoes' },
  { key: 'categorias', label: 'Categorias', href: '/dashboard/acomodacoes/categorias' },
  { key: 'bloqueios', label: 'Bloqueios', href: '/dashboard/acomodacoes/bloqueios' },
  { key: 'tarifas', label: 'Tarifas', href: '/dashboard/acomodacoes/tarifas' },
  {
    key: 'disponibilidade',
    label: 'Disponibilidade',
    href: '/dashboard/acomodacoes/disponibilidade',
  },
  { key: 'canais', label: 'Canais', href: '/dashboard/acomodacoes/canais' },
] as const

export function AcomodacoesTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <div className="border-border flex flex-wrap gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            'rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
            active === tab.key
              ? 'border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground border-transparent',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
