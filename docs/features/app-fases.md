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

## Fechamento automático (etapa 2, migration 0109)

- `close_overdue_stays()`: `checked_in` que passou de `booking_auto_close_at`
  (horário de check-out + 4h, fuso da pousada) vira `checked_out` com
  `checked_out_auto = true` e auditoria `booking.checked_out_auto`. Com consumo
  em aberto, fecha e anota em `checkout_open_note`. Passa pela comissão (0104)
  e pelo pedido de avaliação (0089) como um check-out comum.
- Chamada: rodada diária (`/api/cron/expiracao`, antes das avaliações), ao abrir
  Reservas e o detalhe da reserva no painel, o app da estadia, um pedido novo e
  `/app`. Confirmada sem check-in nunca é fechada pelo sistema.
- `set_booking_status`: check-out com consumo em aberto (entregue não pago +
  pedidos em preparo) exige motivo, que fica em `checkout_open_note`.
- Painel: selos "Fechada pelo sistema" e "Consumo em aberto"; no detalhe, o
  motivo. App do hóspede: aviso do valor em aberto no cartão de fim de estadia.

## Cara da pousada (etapa 3, migration 0110)

- `pousada_guest_settings.app_logo_url`, `app_cover_url`, `app_accent`. A cor
  é uma chave da paleta fixa em `features/app-fases/brand.ts` (todas com
  contraste AA com o texto escuro — testado); o check do banco usa as mesmas
  chaves (testado contra o SQL).
- `get_guest_stay` devolve `brand`; sem capa própria, a foto da pousada. O
  app troca `--ipe` pela cor da pousada, põe o logo no topo e a capa no
  cartão da estadia.
- Painel: Configurações → App do hóspede → "Cara do app" (upload no bucket
  `pousadas`, pasta `<pousada>/app`, com prévia).

## Ofertas para ex-hóspedes (etapa 4, migration 0111)

- Autorização (`offer_consents`, RPC `set_offer_consent`): por pousada, padrão
  desligado, só quem já fez check-out lá liga; desligar vale sempre. No app da
  estadia (cartão de fim de estadia) e em `/conta/ofertas` (link do e-mail).
- Oferta manual (Marketing → Ofertas para ex-hóspedes, `send_pousada_offer`):
  5–50%, 7–90 dias, período de estadia e recado opcionais. Um cupom
  `VOLTAxxxxxx` por pessoa (`pousada_coupons.guest_user_id`, uso único);
  `coupon_evaluate` responde "inválido" para qualquer outra conta. Esses
  cupons não aparecem na lista de cupons.
- Limites (`offer_recipient_allowed`): 1 por mês de cada pousada e 3 por mês
  no total por pessoa; quem tem reserva ativa na pousada não recebe.
- E-mail pela Rota (`lib/email/offer-email.ts`), só das 8h às 21h (Brasília):
  na hora, se o envio for nesse horário; senão pela rodada `/api/cron/ofertas`
  (13h UTC). Marcado só depois de sair; até 3 tentativas.
- Abertura (`?cupom=` na página da pousada, logado) e reserva feita com o
  cupom (gatilho em `booking_coupon_redemptions`) entram no relatório do painel.
- Loja: o cartão da fase mostra a oferta valendo quando não há nada da fase.

## Ofertas automáticas (etapa 5, migration 0112)

- `pousada_auto_offers` (Marketing → Ofertas automáticas): 6 meses e 1 ano
  depois do check-out (janela de 7 dias, sem repetir em 120 dias) e feriadão
  entre 7 e 45 dias à frente (cupom para estadias no feriadão, uma vez por
  feriadão). Tudo pela `create_offer_for_audience` da 0111: mesmos limites.
- `run_auto_offers` roda na rodada `/api/cron/ofertas` (10h), antes dos
  e-mails; o feriadão vem de `features/feriados` (`holidayForOffers`). Só
  pousada publicada.
- O relatório da 0111 mostra o tipo de cada oferta (manual ou automática).

## Ainda não (próximas etapas)

- Pós-estadia não sabe se o hóspede já avaliou (o `booking_id` da avaliação não
  é legível pelo hóspede desde a 0084); some quando ele dispensa ou em 7 dias.
- Loja de apps (Capacitor, notificações nativas, Entrar com a Apple).
