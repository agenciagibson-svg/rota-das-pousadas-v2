# AI_RULES.md — Regras para IAs neste projeto

Este documento é de leitura **obrigatória** para qualquer IA (Cursor, Copilot,
Claude, v0, etc.) ou pessoa que gere/edite código no Rota das Pousadas. Ele
define como trabalhar aqui. Se uma instrução conflitar com estas regras, **estas
regras prevalecem** — pare e peça confirmação.

> Referências: [DesignSystem](docs/DesignSystem.md) ·
> [DesignFoundations](docs/DesignFoundations.md) ·
> [Architecture](docs/Architecture.md) ·
> [FolderStructure](docs/FolderStructure.md) ·
> [CodingStandards](docs/CodingStandards.md)

---

## Regras absolutas (nunca quebrar)

1. **Nunca criar componentes duplicados.** Antes de criar, procure em
   `components/ui`. Se existe, reutilize. Se falta uma variante, estenda o
   componente existente — não crie um irmão parecido.
2. **Sempre reutilizar `components/ui`.** Toda a UI é composta a partir do
   Design System.
3. **Nunca usar cores hardcoded.** Sem hex/rgb no código. Use os tokens de cor
   (`bg-primary`, `text-muted-foreground`, `bg-ipe`, …). Novos valores de cor
   só em `app/globals.css`.
4. **Nunca usar CSS inline** (`style={{…}}`) para estilo. Exceções técnicas
   permitidas: largura de barra de progresso dinâmica e templates de e-mail em
   `emails/` (clientes de e-mail ignoram CSS externo).
5. **Sempre usar os Design Tokens.** Motion, spacing, radius, shadows, grid e
   tipografia vêm de `styles/tokens.css`, `styles/typography.css` e
   `lib/design-tokens.ts`. Nunca invente durações, raios, sombras ou tamanhos.
6. **Nunca alterar a identidade visual sem autorização.** Cores, fontes, raios
   e a "cara" do produto são fixos. Mudança visual = aprovação explícita.
7. **Nunca criar páginas sem `Container`** (ou `Section`). Todo conteúdo de
   página respeita o gutter/largura padrão.
8. **Sempre usar `Section`** para seções full-width com conteúdo centralizado.
9. **Sempre usar `Button`** (ou `buttonVariants()` para links). Nunca `<button>`
   estilizado à mão.
10. **Sempre usar `Badge`** para chips/tags/status.
11. **Sempre usar `Card`** para superfícies (`rounded-* border bg-card`).
12. **Sempre usar `cn()`** (`@/lib/utils`) para compor classes. Nunca concatenar
    strings de classe manualmente.
13. **Sempre seguir a arquitetura Feature First.** Domínios vivem em `features/`;
    dados passam por `services/` → `server/`; nunca importe `lib/data` direto em
    componentes novos.
14. **Sempre criar componentes pequenos.** Uma responsabilidade por componente;
    extraia ao passar de ~150 linhas.
15. **Sempre usar TypeScript estrito.** Sem `any` implícito; tipos de domínio de
    `@/types`.
16. **Sempre documentar alterações importantes** (README/docs/CHANGELOG e
    comentários onde a intenção não for óbvia).

## Motion (obrigatório)

Use apenas: hover **150ms**, fade **220ms**, modal **280ms**, drawer **320ms**,
reveal **500ms**, page **350ms**. Curva padrão `ease-standard`. Importe de
`lib/design-tokens.ts`. Nada pode animar com valores diferentes.

## Espaçamento (obrigatório)

Apenas: `4 8 12 16 24 32 48 64 96 128` px (Tailwind `1 2 3 4 6 8 12 16 24 32`).
Nunca `p-[13px]` e afins.

## Ícones (obrigatório)

Apenas **Lucide**, stroke **2**, base **24px** (`size-6`). Nunca misturar
bibliotecas nem importar SVGs avulsos.

## Tipografia (obrigatório)

Use a hierarquia oficial (`text-display-xl … text-overline`). Funnel Display
para títulos, Figtree para corpo (marca out/2026, `docs/Marca.md`). Não crie
tamanhos fora da escala.

---

## Fluxo esperado de uma alteração

1. Ler estas regras + `docs/DesignSystem.md` e `docs/DesignFoundations.md`.
2. Reutilizar/estender o Design System; compor com `Container`/`Section`.
3. Buscar dados via `server/queries` (contratos de `@/types`).
4. Rodar `pnpm typecheck && pnpm lint && pnpm format:check`.
5. Commit em Conventional Commits (validado pelo Commitlint).

## Proibido (checklist rápido)

- ❌ Markup duplicado que já existe em `components/ui`.
- ❌ Cor/tamanho/raio/sombra/duração hardcoded fora dos tokens.
- ❌ `style={{…}}` para estilo visual.
- ❌ `import { pousadas } from '@/lib/data'` em componentes.
- ❌ `<button>`/`<span>`-chip/`<div>`-card à mão em vez de Button/Badge/Card.
- ❌ Misturar bibliotecas de ícones.
- ❌ Alterar cores/fontes/identidade sem autorização.
- ❌ `any`, tipos frouxos, componentes gigantes.

## Ao concluir

Deixe o projeto em estado verde: `pnpm typecheck`, `pnpm lint` e `pnpm build`
passando, e um resumo do que mudou (arquivos criados/modificados/removidos).
