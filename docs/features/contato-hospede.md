# Contato do hóspede liberado após o pagamento (0105)

Decisão de 19/11/2026: a pousada continua aprovando o comprovante do Pix direto
(o dinheiro cai na conta dela) e a Rota fiscaliza pelo /admin. Para a reserva
vinda da Rota não ser combinada por fora, e-mail e telefone do hóspede só
aparecem para a pousada depois que o pagamento é confirmado.

## Regra

- **Reserva feita pelo viajante no site ou no link da bio** (`bookings.booked_by_traveler`):
  contato oculto até a reserva ficar `confirmed` (ou além). A liberação é gravada
  em `bookings.contact_released_at` e não volta atrás.
- **O que confirma:** a pousada aprovar o comprovante do Pix, o cartão ser aprovado
  no Mercado Pago ou a pousada confirmar a reserva manualmente.
- **Ficha do viajante** (`guests.source` = `public_booking`/`platform_account`): oculta
  até alguma reserva dele ser liberada. Viajante que volta já aparece com contato.
- **Ficha cadastrada pela pousada** (balcão, importação…): nunca é ocultada.
- **Suporte da plataforma** com concessão ativa na pousada vê sempre. Sem
  concessão, ninguém da plataforma lê contato por estas RPCs.

## Como é garantido

| Camada | O que faz                                                                                                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Banco  | `anon`/`authenticated` sem SELECT em `bookings.guest_email/guest_phone` e `guests.email/phone/whatsapp` (e normalizadas)                                                                                 |
| Banco  | `get_booking_guest_contacts`, `get_guest_contacts`, `search_guest_ids_by_contact`: devolvem vazio sem liberação                                                                                          |
| Banco  | Gatilhos: `booked_by_traveler` calculado na criação a partir de quem está logado; `contact_released_at` só pelo gatilho; ficha oculta não troca contato, origem nem conta vinculada por edição da equipe |
| App    | `repositories/guest-contacts.repository.ts`; aviso único `features/reservas/components/contact-hidden-note.tsx`                                                                                          |
| Testes | `supabase/tests/contato-0105.sql`; `repositories/private-columns.test.ts` (nenhum select/filtro direto no contato)                                                                                       |

## Telas

- Reservas (lista e detalhe), Mensagens, Hóspedes (lista e ficha): "Contato liberado após o pagamento".
- Ficha oculta: os campos de contato saem do formulário de edição.
- /admin → Financeiro → **Comprovantes de Pix**: todos os comprovantes do mês, com
  link para o arquivo e o sinal **Cancelada depois de aprovada**.

## Fora deste escopo

- Pedido de orçamento (`quote_requests`) continua chegando com o contato do
  interessado: é feito para a pousada responder.
- Não há conversa dentro da plataforma; enquanto o contato está oculto, a
  pousada não fala com o hóspede por fora.
- O e-mail do hóspede continua sendo usado pelo sistema (confirmação, lembretes),
  sempre do servidor.
