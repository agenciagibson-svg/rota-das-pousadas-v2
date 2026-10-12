import Link from 'next/link'
import { companyLinks, ownerActions, routes } from '@/components/footer-links'

const groups = [
  { title: 'Explorar', links: routes },
  { title: 'Para pousadas', links: ownerActions },
  { title: 'Rota das Pousadas', links: companyLinks },
]

/**
 * Rodapé no celular: os mesmos links dos cartões interativos do desktop, em
 * listas simples. Os cartões (com fotos e descrições) ficam do tablet para
 * cima, onde cabem sem empurrar o rodapé por três telas.
 */
export function FooterMobileLinks() {
  return (
    <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:hidden">
      {groups.map((group) => (
        <div key={group.title}>
          <h2 className="text-liquen text-sm font-semibold">{group.title}</h2>
          <ul className="mt-2">
            {group.links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-linen hover:text-linen/70 flex min-h-11 items-center text-base"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
