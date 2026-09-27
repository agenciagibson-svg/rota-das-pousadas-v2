import type { ReactNode } from 'react'
import Link from 'next/link'
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
      <main className="pt-28 pb-24">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <span className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
            {eyebrow}
          </span>
          <h1 className="text-foreground mt-3 font-serif text-4xl font-semibold sm:text-5xl">
            {title}
          </h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Última atualização: {LEGAL.updatedAt}
          </p>
          <div className="text-foreground/90 mt-6 space-y-4 text-base leading-relaxed">{intro}</div>

          <nav aria-label="Sumário" className="bg-secondary/60 mt-8 rounded-2xl p-5">
            <p className="text-sm font-semibold">Neste documento</p>
            <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-primary hover:underline">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h2 className="text-foreground font-serif text-2xl font-semibold">
                  {i + 1}. {s.title}
                </h2>
                <div className="text-foreground/85 [&_a]:text-primary [&_strong]:text-foreground mt-3 space-y-3 text-[15px] leading-relaxed [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
                  {s.body}
                </div>
              </section>
            ))}
          </div>

          <p className="text-muted-foreground border-border mt-12 border-t pt-6 text-sm">
            Veja também:{' '}
            <Link href={related.href} className="text-primary font-semibold hover:underline">
              {related.label}
            </Link>
            {' · '}Dúvidas:{' '}
            <a
              href={`mailto:${LEGAL.contactEmail}`}
              className="text-primary font-semibold hover:underline"
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
