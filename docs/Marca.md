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

O nome está convertido em curvas (Bricolage Grotesque 800, `opsz` 96), então o
SVG não depende da fonte instalada. Não redesenhe, não estique e não troque as
cores do marcador: o ponto é sempre Ipê.

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

- Títulos: **Bricolage Grotesque** 700/800 (Google Fonts, OFL).
- Texto e interface: **Figtree** 400/600/700 (Google Fonts, OFL), números de
  preço com `tabular-nums`.

## Área de respiro e tamanhos mínimos

- Respiro em volta da logo: a altura do marcador, em todos os lados.
- Horizontal: mínimo de 20px de altura na tela.
- Símbolo: funciona a partir de 16px (favicon).
