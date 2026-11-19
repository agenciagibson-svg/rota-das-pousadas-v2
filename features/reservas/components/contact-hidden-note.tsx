import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 0105: reserva feita pelo site mostra e-mail e telefone do hóspede só depois
 * do pagamento confirmado. Texto único para todas as telas do painel.
 */
export const CONTACT_HIDDEN_SHORT = 'Contato liberado após o pagamento'
export const CONTACT_HIDDEN_LONG =
  'E-mail e telefone aparecem quando o pagamento for confirmado: ao aprovar o comprovante do Pix, quando o cartão for aprovado ou ao confirmar a reserva.'

export function ContactHiddenNote({
  detailed = false,
  className,
}: {
  detailed?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-start gap-1.5', className)}>
      <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {CONTACT_HIDDEN_SHORT}
        {detailed && <span className="mt-1 block text-xs">{CONTACT_HIDDEN_LONG}</span>}
      </span>
    </span>
  )
}
