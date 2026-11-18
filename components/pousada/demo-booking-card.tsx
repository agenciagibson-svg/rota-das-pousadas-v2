import Link from 'next/link'
import { BadgePercent, CalendarDays, Mail, QrCode } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { DEMO_COMMISSION_LABEL, demoCommissionSplit } from '@/features/demonstracao/demo'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: CalendarDays,
    title: 'Escolhe as datas no calendário',
    text: 'com a diária de cada dia e as datas sem vaga riscadas.',
  },
  {
    icon: QrCode,
    title: 'Paga com Pix ou cartão',
    text: 'o Pix cai direto na conta da pousada; o cartão, pelo Mercado Pago.',
  },
  {
    icon: Mail,
    title: 'Recebe a confirmação na hora',
    text: 'e a pousada vê a reserva no painel, com o hóspede e o pagamento.',
  },
  {
    icon: BadgePercent,
    title: `Só ${DEMO_COMMISSION_LABEL} por reserva, sem mensalidade`,
    text: 'a Rota só ganha quando a pousada recebe uma reserva.',
  },
] as const

/**
 * Lugar do card de reserva na página da demonstração (0101). A pousada ainda
 * não é cliente: em vez de reservar, o card mostra ao dono o que o hóspede
 * faria aqui e quanto de uma diária fica com a pousada depois da comissão da
 * Rota. O banco também recusa reserva de pousada não publicada.
 */
export function DemoBookingCard({ pousadaName, from }: { pousadaName: string; from: number }) {
  const { fee, net } = demoCommissionSplit(from)
  return (
    <div id="reservar" className="bg-card shadow-floating scroll-mt-28 rounded-3xl p-6">
      {from > 0 && (
        <p className="text-muted-foreground text-sm">
          a partir de{' '}
          <span className="text-foreground text-2xl font-semibold tabular-nums">
            {formatPrice(from)}
          </span>{' '}
          /noite
        </p>
      )}
      <h2 className="text-foreground mt-3 text-lg font-semibold">Aqui o hóspede reserva direto</h2>
      <ul className="mt-4 flex flex-col gap-4">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <Icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-sm">
              <span className="text-foreground font-semibold">{title}</span>{' '}
              <span className="text-muted-foreground">{text}</span>
            </p>
          </li>
        ))}
      </ul>
      {from > 0 && (
        <dl className="border-border mt-4 flex flex-col gap-2 rounded-2xl border p-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Diária paga pelo hóspede</dt>
            <dd className="text-foreground tabular-nums">{formatPrice(from)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Comissão da Rota ({DEMO_COMMISSION_LABEL})</dt>
            <dd className="text-foreground tabular-nums">− {formatPrice(fee)}</dd>
          </div>
          <div className="border-border flex items-baseline justify-between gap-3 border-t pt-2">
            <dt className="text-foreground font-semibold">Fica com a pousada</dt>
            <dd className="text-foreground font-semibold tabular-nums">{formatPrice(net)}</dd>
          </div>
        </dl>
      )}
      <p className="bg-secondary text-foreground mt-4 rounded-2xl p-3 text-sm">
        Nesta demonstração a reserva fica desligada. Com a {pousadaName} na Rota, este é o botão que
        leva o hóspede até o pagamento.
      </p>
      <Link href="/anunciar" className={cn(buttonVariants({ size: 'lg' }), 'mt-4 w-full')}>
        Quero a minha pousada assim
      </Link>
      <p className="text-muted-foreground mt-2 text-center text-xs">
        Ou responda a mensagem de quem te mandou este link.
      </p>
    </div>
  )
}
