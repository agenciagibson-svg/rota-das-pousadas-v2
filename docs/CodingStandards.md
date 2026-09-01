# Padrões de código

## Linguagem e tipos

- **TypeScript estrito.** Sem `any` implícito. Prefira tipos derivados de
  `@/types` a redeclarar shapes.
- **Tipos de domínio** ficam em `types/`. Não redefina `Pousada`/`Destination`
  em componentes.
- Evite asserções (`as`) exceto em fronteiras justificadas.

## Componentes React

- **Server Components por padrão.** Adicione `'use client'` apenas quando houver
  estado, efeitos ou handlers de interação.
- Um componente por responsabilidade; extraia quando passar de ~150 linhas.
- Props explícitas e tipadas; use `children: ReactNode`.
- React 19: `ref` pode ser passado como prop normal (sem `forwardRef`).
- Nomeie arquivos em `kebab-case.tsx`; componentes em `PascalCase`.

## Estilização

- **Tailwind** com tokens do tema. Não hardcode cores hex fora de
  `globals.css`/`styles/tokens.css`.
- Combine classes com `cn()` (`@/lib/utils`) — nunca concatene strings à mão.
- Reaproveite o Design System (`components/ui`) antes de escrever markup novo.

## Dados

- Componentes buscam dados via `server/queries`, nunca importando `lib/data`
  diretamente em código novo.
- Funções de dado são assíncronas e retornam contratos de `types/`
  (`Paginated<T>`, etc.).
- `services/` e `server/` são `server-only` — não importe em Client Components.

## Acessibilidade

- Botões de ícone têm `aria-label`.
- Elementos interativos têm foco visível (`focus-visible`).
- Overlays: `role="dialog"`, `aria-modal`, Escape para fechar.
- Imagens têm `alt` significativo (decorativas: `alt=""`/`aria-hidden`).

## Formatação (Prettier)

- Sem ponto e vírgula, aspas simples, vírgula final (`all`), largura 100,
  indentação 2. Classes Tailwind são ordenadas pelo plugin.
- Não brigue com o formatter — rode `pnpm format`.

## Commits e branches

Veja [Contributing.md](Contributing.md). Conventional Commits obrigatório.

## Anti-padrões (evite)

- ❌ Markup duplicado que já existe no Design System.
- ❌ `import { pousadas } from '@/lib/data'` em componentes (use `server/`).
- ❌ Cores/tamanhos mágicos hardcoded fora dos tokens.
- ❌ `'use client'` em componente sem interação.
- ❌ Lógica de negócio dentro de `components/ui` (deve ser agnóstico de domínio).
