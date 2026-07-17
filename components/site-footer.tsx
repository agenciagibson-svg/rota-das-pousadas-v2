import Link from 'next/link'
import { Compass, ArrowUpRight } from 'lucide-react'

const columns = [
  {
    title: 'Explorar',
    links: ['Destinos', 'Experiências', 'Pousadas em destaque', 'Ofertas da estação', 'Roteiros'],
  },
  {
    title: 'Para pousadas',
    links: ['Anuncie grátis', 'Dashboard do proprietário', 'Central de reservas', 'Marketing & IA', 'Suporte a parceiros'],
  },
  {
    title: 'Rota das Pousadas',
    links: ['Nossa história', 'Sustentabilidade', 'Imprensa', 'Trabalhe conosco', 'Contato'],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-stone-deep text-linen">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-linen text-primary">
                <Compass className="size-5" />
              </span>
              <span className="font-serif text-lg font-semibold">Rota das Pousadas</span>
            </div>
            <p className="mt-5 text-pretty text-sm leading-relaxed text-linen/70">
              Cada destino tem uma história. Toda grande viagem começa por uma rota. O maior
              ecossistema digital de pousadas do Brasil.
            </p>
            <div className="mt-6 flex gap-3">
              {['Instagram', 'YouTube', 'TikTok'].map((s) => (
                <Link
                  key={s}
                  href="#"
                  className="rounded-full border border-linen/20 px-4 py-2 text-xs font-medium text-linen/80 transition-colors hover:bg-linen hover:text-stone-deep"
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-linen">{col.title}</h4>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link
                      href="#"
                      className="group inline-flex items-center gap-1 text-sm text-linen/60 transition-colors hover:text-linen"
                    >
                      {l}
                      <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-linen/10 pt-8 text-sm text-linen/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Rota das Pousadas. Feito no Brasil.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-linen">Termos</Link>
            <Link href="#" className="hover:text-linen">Privacidade</Link>
            <Link href="#" className="hover:text-linen">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
