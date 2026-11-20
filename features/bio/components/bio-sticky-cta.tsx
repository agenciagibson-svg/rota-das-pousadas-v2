import { CalendarDays } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Barra fixa no rodapé da bio enquanto a pessoa ainda não escolheu datas:
 * preço "a partir de" e o atalho para o seletor de datas. É só um link de
 * âncora (`#datas`) — sem JavaScript.
 */
export function BioStickyCta({ priceFrom }: { priceFrom: number }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="bg-primary text-primary-foreground shadow-floating mx-auto flex max-w-md items-center justify-between gap-3 rounded-full py-2 pr-2 pl-5">
        <span className="min-w-0">
          {priceFrom > 0 ? (
            <>
              <span className="text-primary-foreground/70 block text-xs">a partir de</span>
              <span className="block text-base font-semibold tabular-nums">
                {formatBRL(priceFrom)}
                <span className="text-primary-foreground/70 text-xs font-normal"> / noite</span>
              </span>
            </>
          ) : (
            <span className="block text-sm font-semibold">Reserve direto</span>
          )}
        </span>
        <a
          href="#datas"
          className={cn(buttonVariants({ variant: 'accent', size: 'pill' }), 'shrink-0')}
        >
          <CalendarDays className="size-4" aria-hidden />
          Ver datas
        </a>
      </div>
    </div>
  )
}
