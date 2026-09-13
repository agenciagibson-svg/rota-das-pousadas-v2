# Rota das Pousadas × plano Premium do HQBeds

Auditoria do código em 13/09/2026, item por item da lista do concorrente.
Classificação: **Pronto** · **Parcial** · **Ausente**.

## Itens do plano Premium

| # | Item | Status | Evidência no código |
|---|------|--------|---------------------|
| 1 | Monitor de desempenho | **Parcial** | `owner-dashboard-view.tsx`: os 4 cartões (receita ativa, reservas ativas, pendentes, hóspedes previstos) são calculados das reservas reais. Mas os gráficos "Receita anual" e "Reservas na semana" usam arrays fixos no código (`revenue`, `bookings`), e "Mensagens · 3 novas" é lista inventada. |
| 2 | Governança | **Parcial** | Papel `governanca` no enum (`0012`), RLS que o exclui do cadastro de hóspede (`0030`), e `housekeeping-rooms-view.tsx` com `awaiting_cleaning`/`cleaning`. Falta escala e atribuição por camareira. |
| 3 | Templates de e-mail ilimitado | **Ausente** | Só `emails/base-layout.tsx` (um layout) e textos "pronto para copiar" em `owner-marketing-view.tsx`. Não há cadastro de templates. |
| 4 | E-mails automáticos | **Ausente** | Nenhum provedor de envio nas dependências. `owner-messages-view.tsx` monta o texto e abre `mailto:` — quem envia é o cliente de e-mail da pessoa. |
| 5 | Monitoramento de ocupação | **Ausente** | O donut está fixo em `Donut value={82}` com o texto "8 de 12 acomodações ocupadas esta semana" escrito à mão. O motor de disponibilidade existe, mas nenhuma taxa de ocupação é calculada. |
| 6 | Pré-reserva automática | **Parcial** | `0008` grava `payment_due_at` e o status nasce `pending`. Não há job que expire a reserva quando o prazo vence — hoje ela fica pendente para sempre. |
| 7 | Check-in online | **Ausente** | Existe check-in operacional (status `checked_in`) feito pela recepção. O hóspede não preenche nada antes de chegar. |
| 8 | Ficha FNRH | **Parcial** | `guests` (`0030` + `0043`) já tem `document_type`, `document_number`, `birth_date`, `nationality`, `country`, `city`, `state`, `address`, `cep`. Faltam campos típicos da ficha (profissão, motivo da viagem, meio de transporte, próximo destino) e a ficha imprimível. |
| 9 | Múltiplos pontos de venda | **Ausente** | — |
| 10 | Alertas no Slack | **Ausente** | — |
| 11 | Comandas para consumo avulso | **Ausente** | — |
| 12 | Múltiplos estoques | **Ausente** | — |
| 13 | Comissões por venda para funcionário | **Ausente** | — |
| 14 | Múltiplos caixas | **Ausente** | `finance.repository.ts` só faz listar e inserir **despesas**. Não há caixa, contas a receber nem conciliação. |
| 15 | Chat com Airbnb e Booking | **Ausente** | A tela de mensagens sugere texto e abre `mailto:`. Sem integração com OTA. |
| 16 | Conta de funcionários | **Pronto** | `memberships` com papéis (proprietário, admin, recepcionista, governança, financeiro), convite, ciclo de vida (`0014`) e RPCs com lock de linha (`0020`/`0021`). Mais rigoroso que a média do mercado. |
| 17 | Relatório de análise de hóspedes | **Parcial** | `guests` com filtros de recorrente/incompleto e perfil individual. Não há relatório analítico. |

## Complementos oferecidos por eles

| Item | Status na Rota |
|------|----------------|
| Integrações OTAs | **Ausente** — é o Bloco B do plano do piloto |
| Motor de reservas | **Pronto** — busca com disponibilidade (`0041`), página de reserva e checkout |
| HQPagamentos | **Equivalente pronto** — Mercado Pago com OAuth por pousada, webhook assinado e reconciliação (`0039`/`0042`); falta só validar em sandbox |
| Google Hotéis | **Ausente** |
| Notas fiscais | **Ausente** |

## Leitura

**Placar bruto:** 2 prontos, 5 parciais, 10 ausentes de 17.

**Placar honesto:** dos 10 ausentes, **seis são PDV, estoque, comandas, caixas e
comissão de venda** — isso é ERP de consumo (bar, restaurante, frigobar), não
PMS. Uma pousada de 8 a 12 quartos raramente usa. Comparar por tamanho de lista
favorece quem tem mais módulos, não quem resolve melhor o problema do cliente.

**O que a Rota tem e não está na lista deles:** vitrine/marketplace própria,
concierge de recomendação, multi-tenant com RLS desde a fundação, e — depois da
mudança de hoje — checkout sem comissão, com o hóspede pagando direto à pousada.

## Prioridade real

Perseguir paridade de lista é a armadilha. O que fecha a distância percebida
para o piloto, em ordem:

1. **Ocupação e gráficos de verdade.** Hoje o painel mostra 82% de ocupação e
   "8 de 12 acomodações" inventados. Se o dono da pousada abre o sistema no
   primeiro dia e vê um número que não bate com a casa dele, perde a confiança
   ali — e isso é mais grave que qualquer item ausente da lista do concorrente.
   **Correção antes do piloto, não depois.**
2. **iCal com OTA** (Bloco B do plano) — evita overbooking.
3. **E-mail automático de confirmação e lembrete de check-in.** Um provedor de
   envio e três mensagens cobrem o que o cliente sente como "e-mails
   automáticos" e "templates".
4. **Ficha FNRH imprimível** — os campos já existem no banco; falta a ficha.
5. **Expiração da pré-reserva** — job que cancela quando `payment_due_at` vence.

Os itens 1 e 5 são correções, não features novas: dias de trabalho, não semanas.
PDV, estoque e comandas ficam para quando um cliente pagar por eles.
