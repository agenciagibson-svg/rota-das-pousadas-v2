# Design System

Toda a interface é composta a partir de `components/ui`. Não crie botões, cards,
badges ou seções “na mão” com classes soltas — use (ou estenda) os primitivos.
Isso garante consistência visual e permite mudar a identidade em um só lugar.

```ts
import { Button, Card, Badge, Container, Section, SectionHeading } from '@/components/ui'
```

## Tokens

A fonte da verdade das cores, raios e tipografia está em `app/globals.css`
(variáveis CSS + `@theme`). Tokens complementares (sombras, elevação, motion,
container, z-index, grid) estão em `styles/tokens.css` e espelhados para
TypeScript em `lib/design-tokens.ts` (use estes em animações Motion).

| Grupo | Onde | Exemplos |
|---|---|---|
| Cores de marca | `globals.css` | `--ipe`, `--breu`, `--grafite`, `--liquen`, `--pedra`, `--neblina` (ver `docs/Marca.md`); nomes antigos `--forest`, `--gold`, `--linen`… remapeados para a paleta nova |
| Cores semânticas | `globals.css` | `--primary` (Breu), `--accent` (Ipê, texto Breu), `--muted`, `--border`, `--destructive`, `--success` (só estado) |
| Raio | `globals.css` | `--radius` (0.9rem) + escala `--radius-sm…3xl` |
| Tipografia | `globals.css` | `--font-sans` (Figtree), `--font-display` (Funnel Display; `--font-serif` é apelido dele) |
| Sombras / elevação | `tokens.css` | `--shadow-xs…2xl`, `--elevation-0…5` |
| Motion | `tokens.css` + `design-tokens.ts` | `--ease-standard`, `duration.*`, `easing.*` |
| Container / grid / z-index | `tokens.css` | `--container-2xl`, `--z-modal`, `--grid-gap` |

## Componentes

### Fundações
- **Button** — variantes `default · outline · secondary · ghost · destructive · link · accent · glass · inverse` (`accent` = Ipê, só no caminho de busca/reserva/pagamento; `glass` sobre foto; `inverse` claro sobre Breu); tamanhos `xs · sm · default · lg · icon*` e as pílulas da marca `pill-sm` (36px) · `pill` (48px) · `pill-lg` (56px) · `icon-pill` (48px). `lg` é a pílula de 48px das ações de formulário. Para links estilizados como botão use `buttonVariants()` — ele já resolve conflitos de classe com `cn()`.
- **Badge** — chip/tag/status. Variantes de cor (`secondary`, `primarySoft`, `accentSoft`, `goldSoft`, `destructiveSoft`, `glass`, `outline`) e tamanho (`sm · md · lg`).
- **Card** — superfície (`radius` 2xl/3xl, `border` on/off).
- **Container / Section** — gutter e largura máxima padrão (`max-w-7xl px-5 lg:px-8`).
- **SectionHeading** — marcador da marca + rótulo, título em Funnel Display e descrição (`tone` light/dark).
- **Logo · Marker** (`components/brand/logo.tsx`) — logo C em SVG (`currentColor` + ponto Ipê) e o marcador sozinho.
- **IconBadge** — ícone em quadro suave (`tone` primary/ocean/accent).
- **StatCard** — card de KPI (ícone + delta + valor + rótulo).

### Formulários
- **Input** — campo com label/hint/erro/ícones.
- **SearchField** — campo de busca com ícone circular (usado no hero).

### Feedback e status
- **Skeleton · Loading · EmptyState** — estados de carregamento/vazio/erro. `EmptyState` de página inteira (404, erro, acesso) usa `size="lg" as="h1"`.
- **Toast** (`ToastProvider` + `useToast`) — notificações.
- **Tooltip** — dica em hover/foco (acessível).

### Overlays
- **Modal** — overlay base (portal, Escape, scroll lock, foco preso com `useFocusTrap`; `label` quando não há título visível).
- **Dialog** — modal com título/descrição/rodapé.
- **Drawer** — painel lateral (`side` left/right/top/bottom), corpo rolável e foco preso.

### Exibição de dados
- **Avatar** — imagem com fallback de iniciais.
- **Table** (+ `TableHeader/Body/Row/Head/Cell`) — tabela padronizada.
- **Pagination** — navegação de páginas com reticências.
- **Breadcrumb** — trilha de navegação.
- **Gallery** — `layout="grid"` ou `"hero"` (faixa que desliza no celular + mosaico 4×2 no desktop) + lightbox com setas do teclado.
- **PousadaCard** (`components/pousada/pousada-card.tsx`) — card comparável: foto, cidade, nome, destaques, preço/diária e CTA, sempre na mesma ordem.

### Divulgação e navegação
- **Tabs** · **Accordion** · **Carousel** (scroll-snap acessível).

## Regras de uso

1. **Componha, não copie.** Precisa de um card com sombra? `Card` + className.
2. **Estenda por `className`.** Todos aceitam `className`; a mesclagem usa
   `cn()` (clsx + tailwind-merge), então overrides ganham do padrão.
3. **Novos componentes vão em `components/ui`** e são exportados no `index.ts`.
4. **Acessibilidade não é opcional.** Botões de ícone levam `aria-label`;
   overlays tratam Escape e foco (`hooks/use-focus-trap.ts`); imagens têm
   `alt`; cada página tem um `<main id="conteudo">` (alvo do "Pular para o
   conteúdo" do layout raiz); mensagens assíncronas usam `role="alert"` ou
   `aria-live`. Revisão pelas Web Interface Guidelines da Vercel.
5. **Preserve a identidade.** Cores/raios/tipografia vêm dos tokens — não
   hardcode hex fora de `globals.css`/`tokens.css`.
