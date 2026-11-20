# Origem das reservas (0106)

Cada reserva feita pelo site guarda de onde veio a visita que a gerou, para o
painel e o /admin mostrarem qual canal traz reserva paga.

## Como funciona

1. `components/analytics/origin-capture.tsx` (no layout raiz) lê a URL e o site de
   origem a cada página aberta. Se a visita vem de um link com UTM, de outro site
   ou de um clique de anúncio (`gclid`/`fbclid`), grava o cookie `rp_origem`
   (30 dias, do próprio site, sem dado pessoal). Visita direta não apaga a origem
   anterior.
2. `createBookingAction` chama `recordOriginForNewBooking`, que lê o cookie e
   grava a origem pela RPC `record_booking_attribution`. Falha nunca derruba a
   reserva (vai para o monitoramento).
3. O canal é calculado no banco por `booking_channel` (regra única):
   anúncio do Google → perfil da pousada no Google → busca do Google → Instagram →
   Facebook → WhatsApp → direto → outro.

## Onde aparece

- Painel → Reservas: "via Instagram" ao lado da origem; detalhe da reserva:
  "Origem da visita" com a campanha.
- Painel → Link da bio: **Links com a origem marcada** (bio do Instagram, perfil
  do Google, WhatsApp), gerados por `marketingLinks`.
- /admin → Relatórios: **Reservas por canal** (criadas, pagas, conversão, valor
  pago; `?canal=YYYY-MM` muda o mês).

## Regras do banco

- Só o próprio viajante grava, só para a reserva dele, até 2 horas depois de
  criada; gravada uma vez, não muda.
- A equipe da pousada lê a origem das próprias reservas (RLS); o resumo do
  /admin é da equipe da plataforma.
- Teste: `supabase/tests/origem-0106.sql`.
