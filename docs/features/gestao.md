# Feature: Gestão da Pousada (PMS) — Reservas + Calendário

Primeiro módulo do sistema de gestão (PMS/ERP) para o proprietário: ver as
reservas reais da sua pousada e gerenciar a disponibilidade (bloquear/liberar
datas). Base para os próximos módulos (financeiro, RH, etc.).

## Camadas (ordem da arquitetura)

| Camada            | Arquivo                                                                             | Papel                                                                |
| ----------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Calendário (puro) | `features/gestao/calendar.ts`                                                       | grade do mês + status por dia (testado)                              |
| Types             | `features/gestao/types.ts`                                                          | `OwnerReservation`, `ManagedPousada`                                 |
| Schemas           | `features/gestao/schemas.ts`                                                        | `dateActionSchema` (bloqueio)                                        |
| Repository        | `repositories/management.repository.ts`                                             | pousada gerida, reservas por pousada, availability (block/unblock)   |
| Service           | `features/gestao/services/pms.service.ts`                                           | resolve pousada do dono (membership), reservas, calendário, bloqueio |
| Server Query      | `server/queries.ts` → `getOwnerPousada`, `getOwnerReservations`, `getOwnerCalendar` | cache por request                                                    |
| Server Action     | `features/gestao/actions.ts`                                                        | `blockDateAction`, `unblockDateAction`                               |
| Components        | `reservations-calendar`, `owner-reservations-table`, `owner-reservations-view`      | calendário interativo + tabela + shell                               |
| Páginas           | `app/dashboard` (visão geral) e `app/dashboard/reservas`                            | dashboard real + gestão                                              |

## Como funciona

- A pousada gerida é resolvida pelos **memberships** do usuário
  (`proprietario`/`admin_pousada`). O painel deixa de ser mock: mostra o nome da
  pousada, as **reservas reais** e o **calendário** com datas ocupadas.
- **Calendário**: dias ocupados por reservas (status que ocupam), dias
  bloqueados (tabela `availability`) e dias livres. Clique num dia livre para
  **bloquear**; clique num bloqueado para **liberar** (Server Actions).
- **Privacidade**: a visão do proprietário mostra código/datas/valor/status —
  **não expõe PII do hóspede** (respeita a RLS de `profiles`).
- **Segurança**: RLS (`auth_is_member_of`) garante que o dono só vê/gerencia a
  própria pousada; o service reforça na aplicação (dupla barreira).

## Pré-requisito (via rápida)

Vincular um usuário como proprietário (enquanto o onboarding com aprovação do
admin não existe):

```sql
update pousadas set owner_id = (select id from auth.users where email='EMAIL')
where slug='refugio-das-nuvens';
insert into memberships (user_id, pousada_id, role)
select u.id, p.id, 'proprietario' from auth.users u, pousadas p
where u.email='EMAIL' and p.slug='refugio-das-nuvens'
on conflict (user_id, pousada_id) do nothing;
```

## Avaliações — checagem de permissão (16/09/2026)

- `respondOwnerReview` (`pms.service.ts`) ganhou a mesma checagem explícita
  das funções irmãs do arquivo: `can(role, 'review:respond')` (proprietário,
  admin_pousada, suporte, master). Antes não havia nenhuma — a RLS de
  `reviews` já recusava a escrita de quem não podia, então não era vazamento
  de dado, só um erro cru do Postgres em vez de mensagem amigável.
- `server/queries.ts#canRespondReviews` + prop `canRespond` em
  `OwnerReviewsView`: sem a permissão, o formulário de resposta some (fica
  só um aviso, e só quando a avaliação ainda não tem resposta).

## Avaliações — quem avalia e quem responde (0066)

- Só avalia quem se hospedou: inserir em `reviews` exige reserva do próprio
  autor naquela pousada, com a estadia encerrada (`checked_out`, ou
  confirmada com a saída já passada), e sem `response`. Antes, qualquer
  usuário logado avaliava qualquer pousada chamando a API do Supabase.
- Na edição, o trigger `trg_guard_review_changes` separa os papéis: o autor
  mexe na própria nota e no comentário, a pousada só na resposta (antes o
  dono conseguia trocar a nota do hóspede), e ninguém troca pousada,
  reserva ou autor. A equipe da plataforma (moderação) segue livre.
- O site ainda não tem tela para o hóspede avaliar; a regra já vale para
  quando existir.

## Próximos passos

- Onboarding + aprovação da pousada pelo admin (substitui o vínculo manual).
- Acomodações (múltiplos quartos) e disponibilidade por quarto.
- Módulos financeiro e RH/funcionários.
- Bloquear reserva em datas indisponíveis (integrar `availability` ao fluxo do hóspede).

## Visão geral e agenda: "hoje" da pousada (23/09/2026)

- O painel calculava "hoje" com `toISOString()`, a data de UTC: das 21h à
  meia-noite as chegadas, saídas e a ocupação de amanhã apareciam como de
  hoje, e na agenda o dia de hoje virava "passado". Agora o "hoje" vem do
  fuso da pousada (`pousadas.timezone`, via `pousadaToday` em
  `features/dashboard/metrics.ts` e `isoDateInTimeZone` em `lib/dates.ts`),
  calculado no servidor e passado para a agenda.
- Configurações só aceitam fuso IANA (ex.: `America/Sao_Paulo`); texto livre
  como "Brasília" o banco não reconhece.
- "Próximas reservas" (`upcomingReservations`): entradas a partir de hoje,
  só pendentes, confirmadas e hospedadas, da mais próxima para a mais
  distante. Antes eram as cinco de entrada mais antiga, inclusive canceladas.
- Desbloquear dia pela agenda: `unblockCalendarDay` comparava as datas como
  texto (`+00:00` do PostgREST contra `.000Z` do `toISOString()`), nunca
  achava o bloqueio do dia e respondia "Este dia faz parte de um bloqueio
  maior". Agora compara os instantes.
- Testes: `features/dashboard/metrics.test.ts`,
  `repositories/room-blocks.repository.test.ts` e
  `features/gestao/schemas.test.ts`.

## Mapa de ocupação (0096, 26/10/2026)

`/dashboard/reservas/ocupacao` (aba "Mapa de ocupação" ao lado de "Lista e
calendário"; mesmo acesso de Nova reserva, `booking:manage`). Quartos nas
linhas, noites nas colunas (a coluna do dia D é a noite D→D+1; a saída não
ocupa coluna). Janela de 14 ou 30 dias navegável, começando ontem.

- Barras com a cor do status (`BOOKING_STATUS` → variantes do `Badge`);
  bloqueios e noites vendidas no Airbnb/Booking (iCal, `channel_events`) como
  faixas fixas tracejadas.
- Noite livre → "Nova reserva" com `?quarto=&entrada=&saida=`; o formulário
  consulta a disponibilidade sozinho e escolhe o quarto se continuar livre.
- Computador: arrastar a barra (outro quarto/datas, mesma duração) ou puxar a
  borda direita (mudar a saída), com Pointer Events nativos. Celular e
  teclado: tocar/Enter na barra → "Mover" (formulário de quarto e datas).
- Ao soltar: confirmação com de/para e o valor. Regra do valor: o total
  combinado fica; o recalculado pelas tarifas (só as diárias trocam; desconto,
  acréscimo e serviços ficam) aparece como opção que a pessoa precisa marcar,
  e nunca abaixo do que já foi pago.
- Banco: RPC `move_booking` (0096) — permissão antes do lock; advisory lock
  por quarto (ordem de uuid) e depois `for update` na reserva; pending e
  confirmed mudam tudo; checked_in só a saída; origem Airbnb/Booking/Expedia
  não se move (espelho do canal); mesma checagem de disponibilidade da
  criação/edição; auditoria `booking.period_changed`/`room_changed`/
  `values_changed` com `via = 'mapa_ocupacao'`.
- Lógica pura em `features/gestao/occupancy.ts` (espelha as regras da RPC só
  para avisar na hora; o banco decide).
- Testes: `features/gestao/occupancy.test.ts`,
  `features/gestao/services/occupancy.service.test.ts`,
  `features/gestao/components/occupancy-grid.test.tsx`,
  `supabase/tests/mover-reserva-0096.sql` e `concurrent-move.sql`.
