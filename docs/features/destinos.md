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

## Páginas por estado

`/destinos/<uf>` (ex.: `/destinos/mg`, mesma rota dinâmica — slug de 2 letras é estado):
cidades com foto e pousadas mais avaliadas. Só vai para o Google (sitemap e `index`)
com 2+ cidades; com uma só fica `noindex`, para não repetir a página da cidade.
A trilha da cidade passa pelo estado.

## Texto e dados estruturados

- Título: "Pousadas em <Cidade>, <UF>". Descrição, abertura e perguntas saem só
  dos dados das pousadas; pergunta sobre pet ou avaliação só aparece com dado.
- JSON-LD: `BreadcrumbList`, `ItemList` das pousadas e `FAQPage` (`features/destinos/seo.ts`).
- A página de cada pousada liga para a página da cidade ("Ver pousadas em …").

## Guia da cidade (capa e passeios)

`features/destinos/guias.ts` guarda, por cidade, a foto de capa, uma frase e os
passeios com foto (Unsplash, local conferido; créditos em `docs/creditos-imagens.md`).
Ordem da capa: foto do destino em /admin → Destinos, depois a capa do guia.
Hoje: Tiradentes (MG). Cada cidade nova com pousada ganha o seu guia.

## Próximo passo possível

Texto editorial por cidade (o que fazer, quando ir), escrito pela equipe no /admin.
Exige coluna nova e migration.
