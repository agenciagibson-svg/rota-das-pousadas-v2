import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Como excluir sua conta',
  description:
    'Passo a passo para excluir sua conta da Rota das Pousadas e o que acontece com seus dados.',
  alternates: { canonical: '/excluir-conta' },
}

/**
 * Página pública (sem login) exigida pela Google Play para apps com conta:
 * explica como excluir pelo site e dá um contato para quem não consegue
 * entrar. Por requisição por causa da CSP com nonce (ver app/dynamic-pages.test.ts).
 */
export const dynamic = 'force-dynamic'

const steps = [
  'Entre na sua conta.',
  'Abra “Meu perfil” no menu.',
  'No fim da página, em “Excluir minha conta”, digite seu e-mail e confirme.',
]

export default function ExcluirContaPage() {
  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="pt-32 pb-24">
        <Container className="max-w-3xl">
          <h1 className="text-display-l text-foreground">Como excluir sua conta</h1>
          <p className="text-muted-foreground mt-3 text-base">
            Você pode excluir sua conta da {LEGAL.brand} quando quiser, pelo próprio site.
          </p>

          <Card radius="3xl" border={false} className="mt-8 p-6">
            <h2 className="text-h3 text-foreground">Pelo site</h2>
            <ol className="text-foreground/90 mt-4 list-decimal space-y-2 pl-5 text-base">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <Link href="/conta" className={buttonVariants({ size: 'pill', className: 'mt-6' })}>
              Ir para Meu perfil
            </Link>
            <p className="text-muted-foreground mt-4 text-sm">
              Se você tem uma reserva em andamento, cancele ou aguarde o fim da estadia antes. Se
              você é dono de uma pousada, fale com o suporte.
            </p>
          </Card>

          <Card radius="3xl" border={false} className="mt-6 p-6">
            <h2 className="text-h3 text-foreground">O que acontece com seus dados</h2>
            <ul className="text-foreground/90 mt-4 list-disc space-y-2 pl-5 text-base">
              <li>
                Apagamos na hora seu cadastro: nome, documento, endereço, telefone, contato de
                emergência e favoritos. Você sai da conta em todos os aparelhos.
              </li>
              <li>
                Reservas, pagamentos, a ficha de hospedagem e as avaliações que você escreveu ficam
                com a pousada, porque a lei obriga a guardar, mas deixam de ficar ligados à sua
                conta.
              </li>
              <li>A exclusão não pode ser desfeita. Para voltar, crie uma conta nova.</li>
            </ul>
          </Card>

          <Card radius="3xl" border={false} className="mt-6 p-6">
            <h2 className="text-h3 text-foreground">Não consegue entrar?</h2>
            <p className="text-foreground/90 mt-4 text-base">
              Escreva para{' '}
              <span className="text-foreground font-semibold break-all select-all">
                {LEGAL.contactEmail}
              </span>{' '}
              a partir do e-mail da sua conta, pedindo a exclusão. Respondemos em até 15 dias.
            </p>
          </Card>

          <p className="text-muted-foreground mt-8 text-sm">
            Mais detalhes na{' '}
            <Link
              href="/privacidade#retencao"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </Container>
      </main>
      <SiteFooter />
    </div>
  )
}
