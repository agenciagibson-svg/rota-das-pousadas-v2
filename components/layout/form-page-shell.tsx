import type { ReactNode } from 'react'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { Container } from '@/components/ui/container'
import { Marker } from '@/components/brand/logo'
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
      <SiteHeader forceSolid />

      <main id="conteudo" tabIndex={-1} className="relative pt-32 pb-24 lg:pt-40 lg:pb-32">
        <Container className="max-w-3xl">
          <div className="text-center">
            <span className="text-overline inline-flex items-center gap-2">
              <Marker className="text-foreground" />
              {eyebrow}
            </span>
            <h1 className="text-display-l text-foreground mt-4">{title}</h1>
            {description && (
              <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg leading-relaxed text-pretty">
                {description}
              </p>
            )}
          </div>

          <Card radius="3xl" border={false} className="mt-10 p-6 sm:p-10">
            {children}
          </Card>

          {backHref && backLabel && (
            <p className="text-muted-foreground mt-8 text-center text-base">
              <Link
                href={backHref}
                className="text-foreground font-semibold underline-offset-4 hover:underline"
              >
                {backLabel}
              </Link>
            </p>
          )}
        </Container>
      </main>
    </div>
  )
}
