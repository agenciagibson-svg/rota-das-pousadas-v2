# Fundações de Design

Padrões oficiais e **não-negociáveis** de motion, espaçamento, radius, sombras,
ícones, grid e tipografia. Nada no projeto pode usar valores fora destas escalas.

Fontes da verdade:

- CSS: `styles/tokens.css` (motion, spacing, radius, shadows, grid, z-index, icons)
  e `styles/typography.css` (hierarquia tipográfica).
- TypeScript: `lib/design-tokens.ts` (mesmos valores para animações Motion/charts).
- Cores e fontes: `app/globals.css`.

---

## 1. Motion

**Regra:** nada pode ter animações diferentes. Use somente estas durações e a
curva `standard` como padrão.

| Uso | Duração | Token CSS | Token TS |
|---|---|---|---|
| Hover / micro-estado | **150ms** | `--motion-hover` | `duration.hover` |
| Fade / tooltip / toast | **220ms** | `--motion-fade` | `duration.fade` |
| Modal / Dialog | **280ms** | `--motion-modal` | `duration.modal` |
| Drawer / Sheet | **320ms** | `--motion-drawer` | `duration.drawer` |
| Hero / Scroll reveal | **500ms** | `--motion-reveal` | `duration.reveal` |
| Transição de página/seção | **350ms** | `--motion-page` | `duration.page` |

**Easing:** `--ease-standard` = `cubic-bezier(0.22, 1, 0.36, 1)` (assinatura da
marca). Alternativas: `--ease-out`, `--ease-in-out`.

```tsx
import { duration, easing } from '@/lib/design-tokens'
transition={{ duration: duration.reveal, ease: [...easing.standard] }}
```

`prefers-reduced-motion` é respeitado globalmente (animações reduzidas a ~0ms).

---

## 2. Espaçamento

**Regra:** nunca use valores aleatórios. Apenas esta escala (px):

```
4   8   12   16   24   32   48   64   96   128
```

Equivalência Tailwind (base 4px): `1 2 3 4 6 8 12 16 24 32`
(ex.: `p-4` = 16px, `gap-6` = 24px, `py-8` = 32px). Tokens: `--space-1 … --space-32`.

| px | Tailwind | Uso típico |
|---|---|---|
| 4 | `1` | gaps mínimos, ícone↔texto |
| 8 | `2` | gaps internos |
| 12 | `3` | padding compacto |
| 16 | `4` | padding padrão de card |
| 24 | `6` | gap de grid |
| 32 | `8` | padding de painel |
| 48 | `12` | espaçamento entre blocos |
| 64 | `16` | seções (mobile) |
| 96 | `24` | seções (desktop) |
| 128 | `32` | respiros grandes |

---

## 3. Radius

Escala oficial (base `--radius` = 0.9rem):

| Token | Tailwind | Valor | Uso |
|---|---|---|---|
| `xs` | `rounded-xs` | ~0.34rem | detalhes pequenos |
| `sm` | `rounded-sm` | ~0.53rem | inputs compactos |
| `md` | `rounded-md` | ~0.65rem | botões pequenos |
| `lg` | `rounded-lg` | 0.9rem | botões, chips |
| `xl` | `rounded-xl` | ~1.15rem | inputs, icon badges |
| `2xl` | `rounded-2xl` | ~1.4rem | cards, painéis |
| `3xl` | `rounded-3xl` | ~1.9rem | cards grandes, modais |
| `full` | `rounded-full` | 9999px | pills, avatares, botões redondos |

---

## 4. Sombras / Elevação

Nomes semânticos (geram utilitários `shadow-*` no Tailwind):

| Nome | Utilitário | Uso |
|---|---|---|
| Surface | `shadow-surface` | separação sutil sobre o fundo |
| Card | `shadow-card` | cards em repouso |
| Elevated | `shadow-elevated` | hover de card, dropdowns |
| Floating | `shadow-floating` | popovers, elementos flutuantes |
| Modal | `shadow-modal` | diálogos e overlays |
| Premium | `shadow-premium` | destaques hero / CTA principal |

Todas são "warm-tinted" (base `rgb(31 36 32)`) para casar com a paleta de areia.

---

## 5. Ícones

**Regra:** nunca misturar bibliotecas.

- Biblioteca única: **Lucide** (`lucide-react`).
- Espessura de traço: **2** (aplicada globalmente a `svg.lucide`).
- Tamanho base: **24px** (`size-6`); variações permitidas via utilitários
  `size-4` (16), `size-5` (20), `size-6` (24) conforme o contexto.
- Nunca importar SVGs avulsos ou outra icon library.

```tsx
import { Compass } from 'lucide-react'
<Compass className="size-6" />
```

---

## 6. Grid

| Breakpoint | Largura | Colunas | Gutter |
|---|---|---|---|
| Mobile | < 640px | **4** | 24px |
| Tablet | 640–1024px | **8** | 24px |
| Desktop | ≥ 1024px | **12** | 32px |

Container: `max-w-7xl` (90rem) com gutter `px-5` (20px) e `lg:px-8` (32px) —
encapsulado em `Container`/`Section`. Grids de conteúdo devem se alinhar a
4/8/12 colunas por breakpoint.

---

## 7. Tipografia

Fontes (marca out/2026, `docs/Marca.md`): **Funnel Display** (sem serifa —
display/títulos; classe `font-display`, e `font-serif` continua como apelido) e
**Figtree** (corpo/rótulos). Títulos leves e abertos: nada de 700/800 nem
espaçamento apertado. Hierarquia como classes utilitárias (`styles/typography.css`):

| Estilo | Classe | Fonte | Tamanho (mobile → desktop) | Peso · espaçamento |
|---|---|---|---|---|
| Display XL | `text-display-xl` | display | 40 → 56 → 80px | 500 · -1% (2ª linha do hero em `font-light`) |
| Display L | `text-display-l` | display | 32 → 40 → 48px | 500 · -0,5% a -1% |
| H1 | `text-h1` | display | 28 → 40px | 500 · -0,5% a -1% |
| H2 | `text-h2` | display | 24 → 32px | 500 · -0,5% |
| H3 | `text-h3` | display | 20px | 600 · 0 |
| H4 | `text-h4` | sans | 16px | 600 |
| Body L | `text-body-l` | sans | 18px | 400 |
| Body | `text-body` | sans | 14px | 400 |
| Caption | `text-caption` | sans | 12px | 400 (muted) |
| Overline | `text-overline` | sans | 14px, frase normal (sem caixa alta) | 600 (muted) |

Rótulos de seção usam `SectionHeading`, que põe o marcador da marca (`Marker`,
o "o" da logo) antes do texto. Ao combinar uma classe da escala com uma cor via
`cn()`, as duas ficam (o `lib/utils.ts` registra a escala no tailwind-merge).

```tsx
<h1 className="text-display-l">Onde o Brasil respira mais fundo</h1>
<span className="text-overline">Destinos em destaque</span>
```
