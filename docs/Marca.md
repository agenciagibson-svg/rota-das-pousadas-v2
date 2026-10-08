# Marca — Rota das Pousadas (out/2026)

Identidade escolhida na etapa 1.5 do redesign: **logo C, "Ponto de chegada"**.
O "o" de _rota_ é um marcador: anel com um ponto Ipê no centro, o mesmo sinal
que marca destinos e preços na interface. Sem fontes serifadas.

## Arquivos (`public/assets/brand/`)

| Arquivo                        | Uso                                                                      |
| ------------------------------ | ------------------------------------------------------------------------ |
| `logo-horizontal.svg`          | Fundo claro (texto Breu)                                                 |
| `logo-horizontal-negativo.svg` | Fundo escuro (texto Neblina)                                             |
| `logo-horizontal-branco.svg`   | Sobre foto, com vidro escuro por trás                                    |
| `simbolo.svg`                  | Ícone do app e favicon (placa Breu)                                      |
| `simbolo-negativo.svg`         | Placa clara para fundos escuros                                          |
| `simbolo-solto*.svg`           | Só o marcador, sem placa (avatar, selo, carregando)                      |
| `favicon/`                     | `favicon.ico` (16/32/48), `icon.svg`, PNGs 192/512, maskable e apple 180 |

O nome está convertido em curvas (Funnel Display 500, espaçamento natural da
fonte), então o SVG não depende da fonte instalada. O anel do marcador tem a
mesma espessura do traço do "o" e o ponto ocupa 60% do miolo, para continuar
visível no cabeçalho. Não redesenhe, não estique e não troque as cores do
marcador: o ponto é sempre Ipê.

## Cores

| Nome    | Hex       | Uso                                           |
| ------- | --------- | --------------------------------------------- |
| Ipê     | `#F4B42A` | Único acento: ação de reserva/busca e o ponto |
| Breu    | `#0F1716` | Texto e superfícies escuras                   |
| Grafite | `#4F5955` | Texto de apoio                                |
| Líquen  | `#A9B3AE` | Apoio sobre o escuro                          |
| Pedra   | `#C9D0CC` | Bordas e divisores                            |
| Neblina | `#EEF1EF` | Fundo das páginas                             |
| Branco  | `#FFFFFF` | Cards e formulários                           |

Texto Breu sobre Ipê: contraste 9,9:1. Nunca use Ipê como cor de texto sobre
fundo claro.

## Tipografia

- Títulos: **Funnel Display** (Google Fonts, OFL). Peso 500 nos títulos
  grandes, 600 em títulos de até 24px (nome da pousada no card) e 300 só na
  segunda linha do título principal, uma vez por página, no lugar do contorno.
- Espaçamento dos títulos: -1% a partir de 40px, -0,5% entre 24 e 39px, zero
  abaixo disso. Altura de linha mínima de 1,04. Nada de títulos em 700/800 nem
  espaçamento apertado: a marca pede leveza.
- Escala: display 80/40px (desktop/celular), título de seção 40/28px.
- Texto e interface: **Figtree** 400/600/700 (Google Fonts, OFL), números de
  preço com `tabular-nums`.

## Área de respiro e tamanhos mínimos

- Respiro em volta da logo: a altura do marcador, em todos os lados.
- Horizontal: mínimo de 20px de altura na tela.
- Símbolo: funciona a partir de 16px (favicon).
