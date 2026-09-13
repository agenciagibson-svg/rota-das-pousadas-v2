import type { ReactNode } from 'react'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'

/**
 * Shell padrão para páginas de formulário único (anunciar pousada, cadastro
 * de pousada pelo admin, telas de erro de checkout): cabeçalho + texto de
 * apresentação em escala grande (igual às seções principais do site) +
 * cartão de formulário largo, com manchas de cor de fundo pra a página não
 * ficar com aquele vazio abaixo do conteúdo em telas altas. Usar aqui em vez
 * de remontar `Container`/`Card`/tamanhos de texto em cada página nova.
 */
export function FormPageShell({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  backHref?: string
  backLabel?: string
  children: ReactNode
}) {
  return (
    <div className="bg-background relative min-h-screen overflow-hidden">
      <div className="bg-primary/10 pointer-events-none absolute -top-24 -right-24 size-96 rounded-full blur-3xl" />
      <div className="bg-accent/10 pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full blur-3xl" />

      <SiteHeader forceSolid />

      <main className="relative pt-32 pb-24 lg:pt-40 lg:pb-32">
        <Container className="max-w-3xl">
          <div className="text-center">
            <span className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
              {eyebrow}
            </span>
            <h1 className="text-foreground mt-4 font-serif text-4xl font-semibold text-balance sm:text-5xl">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg leading-relaxed text-pretty">
                {description}
              </p>
            )}
          </div>

          <Card radius="3xl" className="shadow-card mt-10 p-8 sm:p-10">
            {children}
          </Card>

          {backHref && backLabel && (
            <p className="text-muted-foreground mt-8 text-center text-base">
              <Link href={backHref} className="text-primary font-semibold hover:underline">
                {backLabel}
              </Link>
            </p>
          )}
        </Container>
      </main>
    </div>
  )
}
