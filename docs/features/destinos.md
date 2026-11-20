# Páginas por destino

`/destinos` lista as cidades; `/destinos/<cidade-uf>` (ex.: `/destinos/tiradentes-mg`)
mostra as pousadas publicadas da cidade, a faixa de preço, a nota e perguntas
frequentes. Objetivo: aparecer no Google para "pousada em <cidade>".

## Como o destino nasce

- Da cidade e da UF que a própria pousada cadastrou (`features/destinos/destinos.ts`).
  Basta uma pousada publicada (status `publicada`, conta `onboarding`/`active`).
- Grafias diferentes da mesma cidade caem no mesmo slug (acento e caixa ignorados).
- Sem pousada, a página dá 404 e não entra no sitemap. `/destinos` vazio fica `noindex`.
- A tabela `destinations` (mosaico curado da home) continua: quando o nome + UF do
  destino curado bate com uma cidade que tem pousada, o card leva para a página da
  cidade e mostra contagem, preço e nota reais (`withCityPages`).

## Texto e dados estruturados

- Título: "Pousadas em <Cidade>, <UF>". Descrição, abertura e perguntas saem só
  dos dados das pousadas; pergunta sobre pet ou avaliação só aparece com dado.
- JSON-LD: `BreadcrumbList`, `ItemList` das pousadas e `FAQPage` (`features/destinos/seo.ts`).
- A página de cada pousada liga para a página da cidade ("Ver pousadas em …").

## Próximo passo possível

Texto editorial por cidade (o que fazer, quando ir), escrito pela equipe no /admin.
Exige coluna nova e migration.
