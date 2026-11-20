import Link from 'next/link'
import { CalendarDays, Link2, QrCode, Users2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { PLATFORM_COMMISSION_LABEL } from '@/lib/platform-commission'

const perks = [
  {
    icon: QrCode,
    title: 'Reserva paga direto para você',
    text: 'O hóspede paga por Pix na sua chave ou por cartão na sua conta do Mercado Pago.',
  },
  {
    icon: CalendarDays,
    title: 'Calendário num lugar só',
    text: 'Reservas e bloqueios num calendário, que também lê o do Airbnb e o do Booking.',
  },
  {
    icon: Link2,
    title: 'Página de reserva para a bio',
    text: 'Um link para o Instagram e o Google em que o hóspede vê preço e reserva.',
  },
  {
    icon: Users2,
    title: 'Equipe com o acesso certo',
    text: 'Recepção, governança e financeiro, cada um vendo só o que precisa.',
  },
]

/**
 * /anunciar para quem não está logado: o que a Rota oferece e o caminho para
 * criar a conta. É a página que o Google mostra para "cadastrar pousada";
 * antes ela só redirecionava para o login, e o Google não tinha o que ler.
 */
export function AnunciarPitch() {
  return (
    <div>
      <ul className="grid gap-6 sm:grid-cols-2">
        {perks.map((perk) => (
          <li key={perk.title} className="flex items-start gap-3">
            <span className="bg-secondary text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
              <perk.icon aria-hidden className="size-5" />
            </span>
            <span>
              <span className="text-foreground block font-semibold">{perk.title}</span>
              <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
                {perk.text}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-foreground border-border mt-8 border-t pt-6 text-base">
        Sem mensalidade: a Rota fica com {PLATFORM_COMMISSION_LABEL} de cada reserva que ela
        trouxer. Reserva que você lançar no painel não paga nada.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/cadastro?next=/anunciar"
          className={buttonVariants({ size: 'lg', className: 'sm:flex-1' })}
        >
          Criar conta e cadastrar a pousada
        </Link>
        <Link
          href="/login?next=/anunciar"
          className={buttonVariants({ variant: 'outline', size: 'lg', className: 'sm:flex-1' })}
        >
          Já tenho conta
        </Link>
      </div>
    </div>
  )
}
