import type { ReactNode } from 'react'
import Link from 'next/link'
import { Marker } from '@/components/brand/logo'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { LEGAL } from '@/lib/legal'

export type LegalSection = { id: string; title: string; body: ReactNode }

/** Layout comum dos documentos legais: título, sumário clicável e seções numeradas. */
export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
  related,
}: {
  eyebrow: string
  title: string
  intro: ReactNode
  sections: LegalSection[]
  related: { href: string; label: string }
}) {
  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <span className="text-overline inline-flex items-center gap-2">
            <Marker className="text-foreground" />
            {eyebrow}
          </span>
          <h1 className="text-display-l text-foreground mt-3">{title}</h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Última atualização: {LEGAL.updatedAt}
          </p>
          <div className="text-foreground/90 mt-6 space-y-4 text-base leading-relaxed">{intro}</div>

          <nav aria-label="Sumário" className="bg-card mt-8 rounded-3xl p-5 sm:p-6">
            <p className="text-sm font-semibold">Neste documento</p>
            <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-4">
                <h2 className="text-h2 text-foreground">
                  {i + 1}. {s.title}
                </h2>
                <div className="text-foreground/85 [&_a]:text-foreground [&_strong]:text-foreground mt-3 space-y-3 text-[15px] leading-relaxed [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
                  {s.body}
                </div>
              </section>
            ))}
          </div>

          <p className="text-muted-foreground border-border mt-12 border-t pt-6 text-sm">
            Veja também:{' '}
            <Link
              href={related.href}
              className="text-foreground font-semibold underline-offset-4 hover:underline"
            >
              {related.label}
            </Link>
            {' · '}Dúvidas:{' '}
            <a
              href={`mailto:${LEGAL.contactEmail}`}
              className="text-foreground font-semibold underline-offset-4 hover:underline"
            >
              {LEGAL.contactEmail}
            </a>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
