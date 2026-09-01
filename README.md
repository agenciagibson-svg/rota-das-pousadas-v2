# Rota das Pousadas

> Cada destino tem uma história. Toda grande viagem começa por uma rota.

Plataforma (SaaS) do maior ecossistema digital de pousadas do Brasil. Este
repositório contém a base de produto: landing pública, página de detalhe de
pousada, painel do proprietário e painel administrativo master.

Construído com **Next.js 16 (App Router)**, **React 19**, **TypeScript**,
**Tailwind CSS v4** e um **Design System próprio**.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Components) |
| UI | React 19 + Tailwind CSS v4 + base-ui |
| Animação | Motion (Framer Motion) |
| Ícones | lucide-react |
| Qualidade | ESLint 9 (flat) · Prettier · Husky · lint-staged · Commitlint |

## Começando

```bash
pnpm install       # instala dependências e configura o Husky (script prepare)
pnpm dev           # ambiente de desenvolvimento em http://localhost:3000
```

Scripts principais:

```bash
pnpm build         # build de produção
pnpm start         # servidor de produção
pnpm lint          # ESLint
pnpm typecheck     # TypeScript sem emitir
pnpm format        # Prettier (escreve)
pnpm format:check  # Prettier (verifica)
```

Variáveis de ambiente (opcional em dev):

```bash
# .env.local
NEXT_PUBLIC_SITE_URL=https://rotadaspousadas.com.br
```

## Estrutura

Visão de alto nível — detalhes em [`docs/FolderStructure.md`](docs/FolderStructure.md):

```
app/         Rotas (App Router) + loading/error/not-found + SEO (robots, sitemap, manifest)
components/  ui/ (Design System) · seo · seções por área
features/    Domínios (pousadas, marketing, dashboard) — superfície de import
services/    Camada de dados (mock hoje, DB/API amanhã) — server-only
server/      Helpers de acesso a dados com cache por request
actions/     Server Actions (padrão + envelope tipado)
emails/      Templates de e-mail transacional
hooks/       Hooks reutilizáveis
lib/         Utilitários, tokens (TS), SEO, dados mock
types/       Modelo de domínio (fonte da verdade)
styles/      Design tokens (CSS)
docs/        Documentação de engenharia
```

## Documentação

- [Arquitetura](docs/Architecture.md)
- [Estrutura de pastas](docs/FolderStructure.md)
- [Design System](docs/DesignSystem.md)
- [Como contribuir](docs/Contributing.md)
- [Padrões de código](docs/CodingStandards.md)
- [Auditoria técnica](AUDITORIA.md)

## Convenções

Commits seguem [Conventional Commits](https://www.conventionalcommits.org)
(validados pelo Commitlint no hook `commit-msg`). Antes de cada commit, o
`lint-staged` roda ESLint + Prettier nos arquivos alterados.

## Status

Base profissional pronta para receber funcionalidades de negócio (busca, reservas,
autenticação, pagamentos). Nenhuma dessas funcionalidades está implementada ainda —
o foco desta fase foi qualidade técnica, Design System e arquitetura escalável.

---

Projeto originado no [v0](https://v0.app) e elevado a base de produção.
