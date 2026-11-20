import { BadgePercent, CalendarCheck, HandHeart } from 'lucide-react'

/**
 * Três garantias que a Rota consegue cumprir em toda reserva pela bio. Nada de
 * "melhor preço garantido": só o que é verdade sempre.
 */
const ITEMS = [
  { icon: HandHeart, title: 'Direto com a pousada', text: 'Você fala com quem recebe' },
  { icon: BadgePercent, title: 'Sem taxa extra', text: 'O preço é o da pousada' },
  { icon: CalendarCheck, title: 'Vaga em tempo real', text: 'Calendário da própria pousada' },
] as const

export function BioTrust() {
  return (
    <ul aria-label="Por que reservar aqui" className="grid grid-cols-3 gap-2">
      {ITEMS.map(({ icon: Icon, title, text }) => (
        <li
          key={title}
          className="bg-card flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center"
        >
          <Icon className="text-foreground size-5" aria-hidden />
          <span className="text-foreground text-xs leading-tight font-semibold">{title}</span>
          <span className="text-muted-foreground text-xs leading-tight">{text}</span>
        </li>
      ))}
    </ul>
  )
}
