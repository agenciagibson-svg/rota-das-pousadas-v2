# Estrutura de pastas

```
rota-das-pousadas/
├── app/                          # App Router
│   ├── layout.tsx                # layout raiz + metadata base + JSON-LD Organization
│   ├── page.tsx                  # landing (composição das seções)
│   ├── loading.tsx               # estados globais…
│   ├── error.tsx                 #   …de carregamento, erro
│   ├── not-found.tsx             #   …e 404
│   ├── global-error.tsx          # erro no próprio layout raiz
│   ├── robots.ts                 # SEO — robots
│   ├── sitemap.ts                # SEO — sitemap dinâmico
│   ├── manifest.ts               # PWA/web manifest
│   ├── dashboard/                # painel do proprietário (page + loading/error/not-found)
│   ├── admin/                    # painel administrativo (page + loading/error/not-found)
│   └── pousada/[slug]/           # detalhe (page + generateMetadata + loading/error/not-found)
│
├── components/
│   ├── ui/                       # DESIGN SYSTEM (única fonte de componentes)
│   │   ├── button, badge, card, container, icon-badge, section-heading, stat-card
│   │   ├── input, search-field
│   │   ├── skeleton, loading, empty-state, toast, tooltip
│   │   ├── modal, dialog, drawer
│   │   ├── avatar, table, pagination, breadcrumb, gallery
│   │   ├── tabs, accordion, carousel
│   │   └── index.ts              # barrel — importe de '@/components/ui'
│   ├── seo/                      # JsonLd (structured data)
│   ├── landing/                  # seções da landing (Hero, Destinations, …)
│   ├── dashboard/                # shell + charts
│   ├── pousada/                  # detalhe da pousada
│   ├── site-header.tsx  site-footer.tsx  reveal.tsx
│
├── features/                     # domínios (superfície de import)
│   ├── pousadas/    marketing/    dashboard/
│
├── services/                     # camada de dados (server-only)
│   ├── pousadas.service.ts  destinations.service.ts  index.ts
│
├── server/                       # helpers de acesso a dados com cache
│   └── queries.ts
│
├── actions/                      # Server Actions (padrão + helpers)
├── emails/                       # templates de e-mail transacional
├── hooks/                        # use-scrolled, …
├── lib/                          # utils, design-tokens (TS), seo, data (mock), types (shim)
├── types/                        # modelo de domínio (domain.ts) + transporte (api.ts)
├── styles/                       # tokens.css (design tokens globais)
├── docs/                         # esta documentação
└── public/                       # imagens, ícones, favicons
```

## Onde colocar cada coisa

| Preciso de… | Vai em… |
|---|---|
| Um componente visual reutilizável | `components/ui/` (e exporte no `index.ts`) |
| Uma seção específica de página | `components/<area>/` ou `features/<dominio>/` |
| Um tipo de domínio | `types/domain.ts` |
| Ler/escrever dados | `services/` (contrato) + `server/` (cache) |
| Uma mutação por formulário | `actions/` |
| Um utilitário puro | `lib/` |
| Um hook | `hooks/` |
| Um token de design (cor, sombra, motion) | `styles/tokens.css` (+ `lib/design-tokens.ts` para TS) |

## Aliases (tsconfig)

`@/*` aponta para a raiz do projeto. Exemplos: `@/components/ui`, `@/types`,
`@/server/queries`, `@/lib/seo`.
