# App único: loja → estadia → loja

Spec aprovada: projeto, `claude/app-unico-loja-estadia-2026-11-20.md`.
Etapa 1 (esta): porta de entrada única e as 4 fases.

## Fases (`features/app-fases/phase.ts`, função pura)

| Fase       | Regra                                                                |
| ---------- | -------------------------------------------------------------------- |
| `loja`     | Nenhuma reserva ativa                                                |
| `viagem`   | `confirmed` e hoje (fuso da pousada) antes do check-in               |
| `estadia`  | `checked_in`, ou `confirmed` a partir do dia do check-in, até fechar |
| `escolher` | Duas ou mais estadias em curso                                       |
| `pos`      | Fechada há até `POS_DAYS` (7) dias                                   |

- **Fechada** = `checked_out`, data depois do check-out, ou último dia passado
  `AUTO_CLOSE_HOURS` (4) do horário de check-out da pousada (vazio = 12:00).
- Prioridade: estadia > viagem > pós > loja. `pending` (no prazo) nunca muda a
  fase; vira aviso. `cancelled` e `no_show` não geram pós-estadia.
- "Hoje" sempre no fuso da pousada (`pousadas.timezone`).

## Onde é usada

- `/app` — `start_url` do manifesto. Estadia/viagem → `/estadia/[id]`;
  escolher → `/estadia`; pós e loja → `/`.
- `/estadia` — mesma regra (QR do quarto).
- `/api/me/fase` + `PhaseCardBar` na home: atalho para a estadia, a viagem, a
  avaliação (dispensável, `localStorage`) ou o pagamento pendente.
- App da estadia: botão "Explorar pousadas" (a loja não some) e, depois do
  check-out, o cartão "Sua estadia terminou" (avaliar, voltar, outras pousadas).

## Manifesto (`features/app-fases/manifest.ts`)

Um app só na tela inicial: `/site.webmanifest` (id `/`) e o legado
`/estadia/manifest.webmanifest` (id `/estadia`, para quem instalou o antigo
"Minha estadia") abrem em `/app` com escopo `/`. O layout de `/estadia` usa o
manifesto do site. O service worker continua com escopo `/estadia`.

## Ainda não (próximas etapas)

- Fechamento automático **no banco** (pedidos e conta ainda seguem o status da
  reserva; hoje o corte de 4h vale só para a fase do app).
- Pós-estadia não sabe se o hóspede já avaliou (o `booking_id` da avaliação não
  é legível pelo hóspede desde a 0084); some quando ele dispensa ou em 7 dias.
- Cara da pousada (logo, capa, cor), ofertas e loja de apps.
