# Auditoria Técnica — Rota das Pousadas

> Auditoria de arquitetura, UI, UX, código, performance e design system do
> protótipo importado do v0.app. Data: 17/07/2026.
> Foco desta etapa: **diagnóstico completo + melhorias estruturais que não alteram
> o comportamento nem a identidade visual do protótipo.** Nenhuma funcionalidade
> nova foi implementada.

---

## 1. Sumário executivo

O projeto é um protótipo de alta fidelidade gerado no v0, tecnicamente moderno
(Next.js 16 App Router, React 19, Tailwind v4, base-ui, Motion). A identidade
visual é forte e coesa: paleta "verde floresta + laranja pôr do sol + areia",
tipografia Fraunces (serifada) + Manrope (sem serifa), tokens de cor bem
definidos em CSS. As animações de scroll (`Reveal`) e os gráficos SVG próprios
são um diferencial.

O que impede o projeto de ser "profissional e pronto para crescer" hoje não é a
aparência, e sim a **base estrutural**: os dados são arrays estáticos, não há
camada de dados nem modelo de domínio real, padrões visuais estão duplicados
inline em vez de componentizados, a configuração de build mascara erros de tipo
e desliga a otimização de imagens, e há alguns bugs de navegação típicos de
protótipo. Nada disso é grave para um protótipo — mas tudo precisa ser resolvido
antes de escalar para milhares de pousadas.

**Avaliação geral (protótipo → produção):**

| Dimensão | Nota | Comentário |
|---|---|---|
| Identidade visual | 9/10 | Coesa, madura, com personalidade. Preservar. |
| Arquitetura | 4/10 | Boa base (App Router), mas sem camada de dados/domínio nem escalabilidade. |
| UI (componentização) | 4/10 | Padrões repetidos inline; `Button` existe mas não é usado. |
| UX (jornada) | 5/10 | Bonita, porém com links quebrados/fixos e fluxos sem destino real. |
| Performance | 5/10 | Ótimos padrões de imagem, mas anulados por `unopt./ignoreBuildErrors`. |
| Acessibilidade | 6/10 | Boa base (alt, aria-label), lacunas em foco/tabela/calendário. |
| Escalabilidade | 3/10 | Dados hardcoded; sem busca, paginação, DB ou cache. |

---

## 2. Stack e configuração

**Dependências principais:** `next@16.2.6`, `react@19`, `tailwindcss@4.3.3`,
`@base-ui/react@1.5`, `motion@12.42`, `lucide-react@1.16`,
`class-variance-authority`, `clsx`, `tailwind-merge`, `@vercel/analytics`.

Pontos de atenção na configuração:

- **`next.config.mjs` → `typescript.ignoreBuildErrors: true`.** O build ignora
  erros de tipo. Isso esconde problemas reais e derrota o propósito do
  TypeScript. Recomendado remover assim que o código estiver estável (mantido
  por ora para não quebrar o protótipo — ver §11).
- **`next.config.mjs` → `images.unoptimized: true`.** Desliga a otimização
  automática do `next/image` (resize, WebP/AVIF, lazy). Todo o cuidado com
  `sizes`/`fill`/`priority` nos componentes é anulado por esta linha.
- **`package.json` → `name: "my-project"`.** Genérico. ✅ Corrigido nesta etapa.
- **Sem ESLint/Prettier configurados.** O script `lint` chama `eslint .` mas não
  há `.eslintrc`/`eslint.config`. Sem padronização automática de estilo.
- **`lucide-react@^1.16.0`** é uma versão incomum (a linha estável pública é
  `0.x`). Verificar se é intencional; explica o mapeamento `Home`→`House` em
  `experiences.tsx`.

---

## 3. Arquitetura

### 3.1 Estrutura atual

```
app/            layout, page (landing), dashboard, admin, pousada/[slug]
components/     landing/*, dashboard/*, pousada/*, ui/button, site-header, site-footer, reveal
lib/            data.ts (tipos + mock), utils.ts
public/images/  imagens estáticas
```

A organização por área (landing/dashboard/pousada) é um bom começo. Problemas:

- **`lib/data.ts` mistura tipos + dados mock + regras implícitas.** Não há
  fronteira entre "modelo de domínio" e "fonte de dados". Trocar os arrays por
  uma API/DB exigiria mexer em todos os consumidores. ✅ Tipos extraídos para
  `lib/types.ts` nesta etapa.
- **Não existe camada de acesso a dados.** Componentes importam o array
  diretamente (`import { pousadas } from '@/lib/data'`). Não há funções como
  `getPousada(slug)`, `listPousadas({ filtros, paginação })`.
- **`components/ui/` tem só `button.tsx` — e ele não é usado em lugar nenhum.**
  Todo botão da aplicação é uma `<button>`/`<Link>` com classes inline. O design
  system existe no nome, não no uso.
- **Sem `hooks/`, `features/`, `types/` ou barrels.** O `tsconfig` até define o
  alias `@/hooks`, mas a pasta não existia. ✅ Criada nesta etapa (`use-scrolled`).
- **Sem `loading.tsx` / `error.tsx` / `not-found.tsx`** nas rotas.

### 3.2 Estrutura-alvo (preparada para crescer)

Proposta orientada a domínio/feature, mantendo o App Router:

```
app/
  (marketing)/            grupo de rotas públicas (landing, destinos, busca)
    page.tsx
    destinos/[slug]/page.tsx
    pousadas/page.tsx        (listagem com filtros/paginação)
    pousada/[slug]/page.tsx
    loading.tsx  error.tsx  not-found.tsx
  (dashboard)/            grupo do proprietário (layout próprio, auth)
  (admin)/                grupo do admin master (layout próprio, auth)
components/
  ui/                     design system puro (Button, Card, Badge, Input, Dialog…)
  layout/                 SiteHeader, SiteFooter, DashboardShell, Container
  marketing/              Hero, Destinations, Experiences… (composição de ui/)
  charts/                 AreaChart, BarChart, Donut
features/
  pousadas/   { components, server (queries/actions), schema, hooks }
  booking/    { components, server, schema }
  reviews/    …
lib/
  types.ts    utils.ts    constants.ts    format.ts (moeda/data)
  db/         (Drizzle/Prisma)   data/ (repositórios)   validations/ (zod)
hooks/
```

**Princípios:** `ui/` não conhece regra de negócio; `features/` concentram
domínio (componentes + queries + schema juntos); `app/` só compõe. Isso permite
adicionar "reservas", "pagamentos", "mensageria" como features isoladas sem
inchar a landing.

---

## 4. UI

**Pontos fortes:** paleta e tokens consistentes (`--forest`, `--sunset`,
`--gold`, `--sand`…); tipografia com hierarquia clara (Fraunces para títulos,
Manrope para corpo); espaçamentos harmônicos (escala `py-20 lg:py-28` nas
seções); uso correto de `text-balance`/`text-pretty`; raios e sombras coerentes.

**Oportunidades:**

- **Consistência via componentes, não via cópia.** O mesmo "eyebrow + título
  serifado + descrição" aparece em Destinations, Experiences, FeaturedPousadas,
  Editorial com pequenas variações de classe — risco de divergência ao editar.
  ✅ Criado `SectionHeading`. Idem para o gutter de página (`Container`/`Section`,
  ✅ criados) e chips (`Badge`, ✅ criado).
- **Chips/badges divergentes.** Tags usam `px-2.5 py-1 text-[11px]` num lugar e
  `px-3 py-1 text-xs` em outro; status usam variações de cor soltas. O `Badge`
  novo unifica em variantes (`secondary`, `primarySoft`, `goldSoft`, `glass`…).
- **Cards duplicados.** `rounded-2xl border border-border bg-card` (dashboards) e
  `rounded-3xl … bg-card` (pousadas) repetem-se dezenas de vezes. `Card` criado.

### Acessibilidade

- ✅ Bom: `alt` descritivo nas imagens, `aria-label` em botões de ícone, `lang="pt-BR"`.
- ⚠️ Botão do menu mobile dizia sempre "Abrir menu". ✅ Corrigido (`aria-label`
  dinâmico + `aria-expanded`).
- ⚠️ Botões inline (fora do `Button`) não têm anel de foco visível
  (`focus-visible:ring`). O `Button` do design system já traz isso — mais um
  motivo para adotá-lo.
- ⚠️ Calendário de disponibilidade: células são `<button>` sem `aria-label` de
  data nem `aria-pressed`; navegação por teclado limitada.
- ⚠️ Tabela de reservas sem `<caption>`/`scope` nos cabeçalhos.
- ⚠️ Contraste: texto `gold` sobre fundo claro e `text-primary-foreground/70`
  sobre imagens merecem verificação AA.

### Responsividade

Sólida: breakpoints `sm/md/lg/xl` bem usados, `100svh` no hero, tabelas com
`overflow-x-auto`, sidebar do dashboard com drawer no mobile. Sem ressalvas
relevantes.

---

## 5. UX — jornada do usuário

Fluxo atual: **Landing → (card) → Detalhe da pousada → Reservar (sem destino)**;
e **Landing → Dashboard/Admin** direto pelo header.

Pontos confusos / gargalos / bugs de protótipo:

1. **Todos os cards de destino levam à MESMA pousada.** Em
   `destinations.tsx` o link é fixo: `href={`/pousada/refugio-das-nuvens`}`
   (template string sem interpolação). Clicar em "Gramado", "Bonito" ou
   "Noronha" abre sempre o "Refúgio das Nuvens". **É o problema de UX mais
   grave.** Não corrigido nesta etapa por alterar comportamento — ver §11.
2. **"Ver todas as pousadas"** aponta para o detalhe de uma pousada, não para
   uma listagem (que ainda não existe).
3. **Não há página de destino** (`/destinos/[slug]`) nem de **listagem/busca**.
4. **Busca não funciona** (campos sem estado/submit) — esperado num protótipo,
   mas é o principal ponto de conversão da home.
5. **CTA "Anuncie sua pousada"** leva ao `/dashboard` do proprietário em vez de
   um fluxo de cadastro/onboarding.
6. **Header público expõe "Dashboard" e "Admin"** — ok para demo, indevido em
   produção (deveriam viver atrás de autenticação).
7. **Reserva sem checkout:** o botão "Reservar" não avança; datas e hóspedes são
   fixos ("14–16 Mar"), desconectados do calendário selecionável logo acima.

**Oportunidades de conversão:** busca funcional com autocomplete de destino;
filtros por experiência (os 12 chips já existem como taxonomia); prova social
(avaliações já modeladas); urgência/escassez ("últimas unidades"); wishlist
(botão "Salvar" já presente, sem persistência); e-mail de captação no rodapé.

---

## 6. Código

- **Duplicação** já descrita (seções, cards, badges, stat cards, ícone-badge).
  Design system criado para eliminá-la progressivamente.
- **Nomenclatura**: boa no geral. `charts.tsx` exporta `AreaChart/BarChart/Donut`
  claros; `DashboardShell` é reutilizado por dashboard e admin (bom). Sugestão:
  renomear `lib/data.ts` para `lib/mock-data.ts` quando entrar a camada real, e
  padronizar textos PT/EN (código em EN, conteúdo em PT — já é o caso, manter).
- **Tipagem**: arrays `rooms`/`reviews` estavam sem tipo. ✅ Tipados (`Room[]`,
  `Review[]`). Tipos centralizados em `lib/types.ts`.
- **`'use client'` em excesso**: `experiences.tsx` é client mas não tem
  interatividade real (os cards são `<button>` sem handler) — pode ser Server
  Component, reduzindo JS enviado. `hero` e `pousada-detail` legitimamente
  precisam ser client. (Não alterado: mudar server/client pode ter efeitos
  sutis; recomendado como passo seguinte com teste visual.)
- **Formatação de moeda inline** (`R$ {valor}`) espalhada — extrair
  `formatBRL()` em `lib/format.ts` (usa `Intl.NumberFormat`), garantindo
  separador de milhar correto (hoje "R$ 1440" deveria ser "R$ 1.440").

---

## 7. Performance

- ✅ **`next/image`** com `fill`, `sizes` e `priority` no hero — muito bem feito.
  Mas **`images.unoptimized: true` anula tudo**. Recomendação nº1 de
  performance: reativar a otimização (e trocar o `<img>` do `admin` por
  `next/image`).
- ✅ **Server Components por padrão** na landing (exceto onde há interação).
- ⚠️ **`experiences.tsx`** poderia ser server (ver §6) → menos bundle.
- ⚠️ **`motion`** (Framer Motion) é uma lib relativamente pesada usada em
  `Reveal`, hero, charts e pousada. Avaliar `lazy`/`m` + `LazyMotion` para
  reduzir o bundle inicial, ou animações CSS onde bastar.
- ⚠️ **Bundle**: sem análise (`@next/bundle-analyzer`). Recomendado medir.
- **SEO**: `metadata` global existe e é boa, mas **rotas de pousada não têm
  `generateMetadata`** (título/descrição/Open Graph por pousada) — essencial
  para compartilhamento e busca orgânica em escala. Falta também
  `sitemap.ts`/`robots.ts`, dados estruturados (`schema.org/LodgingBusiness`) e
  `canonical`. `generateStaticParams` já é usado no detalhe (ótimo para SSG).

---

## 8. Design System

### 8.1 Inventário de componentes/padrões identificados

| Padrão | Onde aparece hoje | Status |
|---|---|---|
| Button (variants/size) | `ui/button.tsx` existe, **não usado** | Adotar |
| Badge / chip / status | tags, status de reserva, "3 novas", rating | ✅ `Badge` criado |
| Card / surface | dashboards, pousadas, listas | ✅ `Card` criado |
| Container / gutter de página | todas as seções (`max-w-7xl px-5 lg:px-8`) | ✅ `Container`/`Section` |
| Section heading (eyebrow+título) | 4+ seções da landing | ✅ `SectionHeading` |
| Icon badge (ícone em quadro suave) | stats, experiências, features | ✅ `IconBadge` |
| Stat/KPI card | dashboard + admin (duplicado) | ✅ `StatCard` |
| Input / SearchField | hero, header/dashboard (busca) | A criar (`Input`) |
| Dialog / Sheet / Drawer | menu mobile, sidebar (ad-hoc) | A criar |
| Charts | `AreaChart/BarChart/Donut` | OK (mover p/ `components/charts`) |
| Layout shells | `SiteHeader/Footer`, `DashboardShell` | OK |

### 8.2 Biblioteca criada nesta etapa

Em `components/ui/` (importável por `@/components/ui`):

- **`Container` / `Section`** — gutter e largura máxima padronizados.
- **`Badge`** — CVA com variantes de cor e tamanho.
- **`Card`** — surface com raio/borda configuráveis.
- **`IconBadge`** — quadro de ícone (tons primary/ocean/accent, 3 tamanhos).
- **`SectionHeading`** — eyebrow + título serifado + descrição.
- **`StatCard`** — KPI card (compõe Card + IconBadge + Badge).
- **`index.ts`** — barrel de exportação.

Todos derivados **das classes que já existem no protótipo** — mesma aparência,
agora reutilizável. Fonte da verdade dos tokens continua em `app/globals.css`.

### 8.3 A criar (próxima etapa)

`Input`/`SearchField`, `Dialog`/`Sheet`, `Tabs`, `Avatar`, `Table`
(encapsulando o padrão da tabela de reservas), `Skeleton` (para `loading.tsx`) e
`Tooltip`. Depois, **adotar** os primitivos em todas as telas (substituindo o
inline) — é o passo que transforma "biblioteca criada" em "biblioteca usada".

---

## 9. Escalabilidade — de 4 para milhares de pousadas

Hoje os dados são 4 pousadas e 8 destinos em arrays. Para escalar:

1. **Banco de dados + ORM.** Postgres com Drizzle ou Prisma. Modelar
   `Pousada`, `Destino`, `Quarto`, `Reserva`, `Avaliação`, `Anfitrião`,
   `Comodidade` (N:N). Os tipos em `lib/types.ts` já são o rascunho do schema.
2. **Camada de repositório** (`lib/data/`): `listPousadas({ destino, experiencia,
   preco, page, sort })`, `getPousadaBySlug`, `getDestino`. Componentes nunca
   falam com o DB direto.
3. **Busca dedicada.** Com milhares de itens, `Array.filter` não serve. Usar
   Postgres full-text ou Meilisearch/Typesense/Algolia; busca facetada pelas 12
   experiências já modeladas.
4. **Paginação/virtualização** na listagem; **filtros na URL** (searchParams)
   para links compartilháveis e cacheáveis.
5. **Renderização em escala.** SSG + ISR para detalhes de pousada
   (`generateStaticParams` + `revalidate`) e listagem em Server Components com
   `cache`/`unstable_cache`. Evita renderizar milhares de páginas a cada build.
6. **Imagens em CDN** (upload dos anfitriões) com `next/image` + loader remoto e
   `remotePatterns`.
7. **Auth + multi-tenant.** Dashboard por anfitrião, admin master global; RBAC.
   Server Actions para reserva/aprovação.
8. **Observabilidade e qualidade.** ESLint/Prettier, testes (Vitest + Testing
   Library; Playwright para e2e do funil de reserva), CI, e `@next/bundle-analyzer`.
9. **`generateMetadata` + sitemap dinâmico** por pousada/destino para SEO em
   escala.

---

## 10. Achados priorizados

**P0 — antes de qualquer produção**

- Links fixos dos cards de destino (todos → mesma pousada). *(comportamento — §11)*
- `ignoreBuildErrors` e `images.unoptimized` ligados.
- Sem camada de dados/DB (bloqueia escala).
- `generateMetadata`/sitemap ausentes (SEO).

**P1 — qualidade e manutenção**

- Adotar o design system (eliminar UI inline; usar `Button`).
- Páginas de listagem/busca e de destino; busca funcional.
- `loading/error/not-found` por rota; `Skeleton`.
- ESLint/Prettier/testes/CI.
- `formatBRL()` para moeda.

**P2 — refinos**

- `experiences` como Server Component; `LazyMotion`.
- Acessibilidade do calendário e da tabela; foco visível universal.
- Reorganizar em `features/` e `(grupos)` de rota.

---

## 11. O que foi implementado nesta etapa

Somente **melhorias estruturais sem alteração de comportamento ou identidade
visual**, conforme solicitado:

| Mudança | Arquivo(s) | Risco |
|---|---|---|
| Tipos de domínio extraídos p/ `lib/types.ts` (+ `Room`/`Review`) e re-exportados em `data.ts` | `lib/types.ts`, `lib/data.ts` | Nulo (API preservada) |
| `rooms`/`reviews` tipados | `lib/data.ts` | Nulo |
| Biblioteca de primitivos criada | `components/ui/{container,badge,card,icon-badge,section-heading,stat-card,index}` | Nulo (aditivo) |
| Hook `useScrolled` extraído do header | `hooks/use-scrolled.ts`, `site-header.tsx` | Nulo (mesmo comportamento) |
| `aria-label` dinâmico + `aria-expanded` no menu mobile | `site-header.tsx` | Nulo (só a11y) |
| Adoção segura de `Section` (saída idêntica) | `destinations.tsx`, `featured-pousadas.tsx` | Nulo |
| Adoção de `Badge` nas tags dos cards | `featured-pousadas.tsx` | Nulo (mesmas classes) |
| `name` do pacote corrigido | `package.json` | Nulo |

**Verificação:** os novos primitivos + tipos + hook passam em `tsc --noEmit`
sem erros; os arquivos editados foram conferidos individualmente. A adoção dos
primitivos foi restrita a casos cuja saída de classes é idêntica.

**Deliberadamente NÃO alterado** (mudaria comportamento — requer sua aprovação):
correção dos links de destino, `ignoreBuildErrors`/`unoptimized`, conversão de
`experiences` para Server Component, e adoção ampla do design system nas demais
telas.

---

## 12. Roadmap sugerido

1. **Fundação estrutural (1–2 dias):** adotar o design system em todas as telas;
   ESLint/Prettier; `formatBRL`; `loading/error/not-found`.
2. **Camada de dados (2–4 dias):** DB + ORM + repositórios; migrar mocks; manter
   tipos de `lib/types.ts` como schema.
3. **Navegação real (2–3 dias):** listagem/busca, páginas de destino, corrigir
   links, busca funcional, `generateMetadata`/sitemap.
4. **Funil de conversão (3–5 dias):** checkout de reserva, wishlist, captação.
5. **Escala (contínuo):** busca facetada, ISR, CDN de imagens, auth/RBAC,
   testes + CI, análise de bundle.
