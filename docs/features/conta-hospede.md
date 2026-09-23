# Feature: Conta do hóspede (0069)

Consumo lançado a cada pedido e pagamentos da reserva — os do Mercado Pago, que
chegam sozinhos pelo webhook, e os feitos na pousada (dinheiro, PIX direto,
cartão na maquininha), registrados no fechamento. Fica na página da reserva
(`/dashboard/reservas/[id]`), no cartão "Conta do hóspede".

## Camadas

| Camada         | Arquivo                                       | Papel                                                          |
| -------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Banco          | `supabase/migrations/0069_booking_folio.sql`  | `booking_charges`, colunas novas em `payments`, saldo, 4 RPCs  |
| Regras (puro)  | `features/reservas/folio.ts`                  | formas de pagamento, status que aceitam lançamento, formatação |
| Schemas        | `features/reservas/folio-schemas.ts`          | consumo, pagamento, cancelamento e estorno (Zod)               |
| Repository     | `repositories/folio.repository.ts`            | leitura da conta e chamadas das RPCs                           |
| Service        | `features/reservas/services/folio.service.ts` | RBAC (`payment:register` / `payment:refund`) e e-mail          |
| Server Query   | `server/queries.ts` → `getOwnerBookingFolio`  | cache por request                                              |
| Server Actions | `features/reservas/actions.ts`                | lançar, cancelar, registrar e estornar                         |
| UI             | `features/reservas/components/folio/`         | cartão, listas, formulários e diálogo de motivo                |

## Regras

- **Saldo** (`bookings.balance_due`, calculado no banco) = total da estadia +
  consumo − recebido. `bookings.charges_amount` guarda o consumo ativo.
- **Consumo**: descrição, quantidade e valor unitário (com centavos), um
  lançamento por pedido. Só em reserva confirmada, hospedada ou encerrada — a
  pendente ainda aguarda o pagamento da estadia, que o Mercado Pago cobra pelo
  saldo.
- **Pagamento no balcão**: dinheiro, PIX, cartão de crédito ou de débito, com
  observação opcional. Pode ser parcial; nunca maior que o saldo (evita erro de
  digitação). Vale também para reserva pendente:
  - se quitar, a reserva é confirmada e o hóspede recebe o e-mail de
    confirmação, como no Mercado Pago;
  - se for sinal, a reserva sai do prazo de pagamento, para a expiração
    automática (0050) não cancelar uma reserva que já recebeu dinheiro.
- **Nada é apagado**: consumo errado é cancelado e pagamento manual é
  estornado, sempre com motivo; os dois continuam na conta, riscados.
  Pagamento do Mercado Pago só é estornado pelo próprio Mercado Pago.
- **Check-out** com saldo em aberto pede confirmação, mas não é bloqueado
  (acerto posterior, empresa, link de pagamento).
- **Receita**: o consumo entra na receita da reserva no Financeiro e na Visão
  geral.

## Permissões

| Ação                                  | Permissão (RBAC)   | Papéis                                      | Banco                         |
| ------------------------------------- | ------------------ | ------------------------------------------- | ----------------------------- |
| Ver a conta                           | `booking:manage`   | proprietário, gerente, recepção             | RLS `booking_charges_read`    |
| Lançar consumo / registrar pagamento  | `payment:register` | proprietário, gerente, recepção, financeiro | `auth_has_operational_access` |
| Cancelar consumo / estornar pagamento | `payment:refund`   | proprietário, gerente, financeiro           | `auth_has_finance_access`     |

O papel Financeiro tem as permissões de pagamento, mas hoje não abre a página
da reserva (não tem `booking:manage`).

## Auditoria

`audit_log`: `booking.charge_added`, `booking.charge_cancelled`,
`payment.manual_recorded`, `payment.manual_reversed` e `booking.confirmed`
(`metadata.source = 'manual_payment'`).

## Testes e rollback

- `supabase/tests/priorities.sql` (permissões por papel, validações, saldo,
  estorno, cancelamento, sinal e quitação de reserva pendente),
  `features/reservas/folio.test.ts`, `services/folio.service.test.ts`,
  `components/folio/booking-folio.test.tsx` e
  `features/gestao/components/owner-reservation-actions.test.tsx`.
- Rollback: `supabase/rollback/0069_rollback.sql`. Apaga os lançamentos de
  consumo; pagamentos manuais continuam como pagamentos aprovados.
