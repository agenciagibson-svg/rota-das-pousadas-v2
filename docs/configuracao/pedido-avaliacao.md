# Pedido de avaliação por e-mail (0089)

Depois do check-out, o hóspede recebe um e-mail "Como foi sua estadia na …?" com
5 estrelas. Se não avaliar em 3 dias, recebe um único lembrete. A avaliação entra
na nota da pousada na hora.

Não há variável nova. O envio usa o mesmo SMTP e o mesmo cron diário que já existem.

## O que fazer

1. **Aplicar a migration no Supabase.** No painel do Supabase, abra _SQL Editor_,
   cole o conteúdo de `supabase/migrations/0089_pedido_avaliacao.sql` e execute
   (ou use `supabase db push`). Para desfazer: `supabase/rollback/0089_rollback.sql`.
2. **Conferir as variáveis na Vercel** (_Settings → Environment Variables_), que
   já devem estar lá:
   - `CRON_SECRET` (o cron diário `/api/cron/expiracao` usa);
   - `SUPABASE_SERVICE_ROLE_KEY`;
   - `SMTP_USER` e `SMTP_PASS` (sem elas nenhum e-mail sai e nada é marcado como
     enviado; o pedido volta no dia seguinte, por até 3 dias depois do check-out).
3. **Nada muda no `vercel.json`.** O envio roda dentro do cron que já existe,
   todo dia às 07:00 UTC (04:00 em Brasília).

## Quem recebe

Só quem reservou pela Rota (site ou link da bio), com a própria conta e com
e-mail na reserva. Reserva de balcão, de Airbnb/Booking ou criada pela equipe da
pousada não recebe, porque esse hóspede não consegue avaliar. No máximo 50
pedidos e 50 lembretes por dia.

## Como conferir depois de publicar

- Resposta do cron (aparece em _Vercel → Logs_): `reviewRequests: { sent, failed }`
  e `reviewReminders: { sent, failed }`.
- No banco: `bookings.review_requested_at` e `bookings.review_reminded_at`
  preenchidos. A ação `review.requested` é registrada em `audit_log`.
