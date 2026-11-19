# Comissão da Rota por reserva: registro e extratos (0104)

Primeira parte da cobrança do modelo v1.2 (`docs/04_BUSINESS_ARCHITECTURE.md §9`).
O banco **registra** a comissão de cada reserva vinda da plataforma e as telas
mostram o extrato. **Nada é cobrado**: a separação no cartão (Mercado Pago) e a
fatura do Pix direto são entregas seguintes.

## Quando uma reserva gera comissão

No check-out (`status = checked_out`), e só se as duas condições valerem:

1. a origem é a plataforma: `rota_das_pousadas` ou `link_bio`;
2. a pousada já tinha aceitado o contrato quando a reserva foi criada (0103).

Balcão, telefone, WhatsApp, site próprio, Airbnb, Booking e demais canais nunca
geram comissão. Sem contrato aceito, nada é registrado: é o interruptor desta
entrega (o mesmo do aceite).

- **Base:** `bookings.total` (diárias, taxas e serviços da reserva, já com o
  desconto de cupom). Consumo durante a estadia não entra.
- **Percentual:** `platform_commission_rate()` no banco, hoje 6%. É o mesmo
  número de `lib/platform-commission.ts`; `features/comissao/commission.test.ts`
  falha se os dois divergirem.
- **Mês do extrato:** o mês do check-out.
- A linha guarda base, percentual e valor como foram calculados. Mudar o
  percentual ou a data da isenção depois não reescreve o que já foi registrado.
- Check-out desfeito tira a linha; refeito, ela volta recalculada.

## Isenção de lançamento

Reserva **criada** até `pousadas.commission_exempt_until` e com **check-in** até
90 dias depois dessa data fica registrada como isenta (`exempt`). O valor que
seria cobrado continua em `amount`, para o extrato mostrar quanto a pousada
deixou de pagar.

## Onde aparece

- **Painel → Financeiro:** bloco "Comissão da Rota", para dono, gestor e
  financeiro da pousada (`finance:pousada:view` / `auth_has_finance_access`).
  Só aparece para pousada com contrato aceito. Mês na URL: `?mes=2026-12`.
- **/admin → Financeiro:** "Comissões das reservas", por pousada e por mês, para
  financeiro da plataforma e master. Substitui o plano de assinatura, o MRR e
  as faturas de assinatura, que saíram da tela (o código deles continua no
  repositório, sem uso).

## O que ainda não existe

- Cobrança: `marketplace_fee` no cartão e fatura mensal do Pix direto.
- Situação de pagamento da comissão (faturada, paga, em atraso).
- Comissão sobre valor retido em cancelamento ou não comparecimento (cláusula
  4.2 do contrato) e sobre comprovante enviado com reserva cancelada (4.4).
- Dados do hóspede escondidos até a aprovação do comprovante.

## Onde está

- Banco: `supabase/migrations/0104_comissao_registro.sql`, rollback em
  `supabase/rollback/0104_rollback.sql`, teste em
  `supabase/tests/comissao-0104.sql`.
- App: `features/comissao/`, `repositories/commissions.repository.ts`.

## Ordem do deploy

Aplicar a 0104 **antes** do merge. Sem a migration as telas continuam
funcionando: o bloco de comissão simplesmente não aparece.
