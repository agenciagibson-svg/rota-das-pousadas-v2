import { writeFileSync, mkdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { authConfirmSignupTemplate, authMagicLinkTemplate } from './templates'

const templates = {
  'confirmar-cadastro': authConfirmSignupTemplate(),
  'codigo-de-acesso': authMagicLinkTemplate(),
}

describe('modelos do Supabase Auth', () => {
  it.each(Object.entries(templates))('%s leva código, link de um toque e e-mail', (_, t) => {
    expect(t.subject).toContain('{{ .Token }}')
    expect(t.html).toContain('{{ .Token }}')
    expect(t.html).toContain(
      '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email&amp;next={{ .RedirectTo }}',
    )
    expect(t.html).toContain('{{ .Email }}')
    expect(t.html).not.toContain('ConfirmationURL')
    expect(t.html).toContain('Rota das Pousadas')
  })

  it('gera os arquivos para colar no painel (WRITE_AUTH_TEMPLATES=1)', () => {
    if (!process.env.WRITE_AUTH_TEMPLATES) return
    mkdirSync('supabase/templates', { recursive: true })
    for (const [name, t] of Object.entries(templates)) {
      writeFileSync(`supabase/templates/${name}.html`, t.html)
      writeFileSync(`supabase/templates/${name}.assunto.txt`, `${t.subject}\n`)
    }
  })
})
