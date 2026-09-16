# Feature: Gestão da Pousada (PMS) — Reservas + Calendário

Primeiro módulo do sistema de gestão (PMS/ERP) para o proprietário: ver as
reservas reais da sua pousada e gerenciar a disponibilidade (bloquear/liberar
datas). Base para os próximos módulos (financeiro, RH, etc.).

## Camadas (ordem da arquitetura)

| Camada | Arquivo | Papel |
|---|---|---|
| Calendário (puro) | `features/gestao/calendar.ts` | grade do mês + status por dia (testado) |
| Types | `features/gestao/types.ts` | `OwnerReservation`, `ManagedPousada` |
| Schemas | `features/gestao/schemas.ts` | `dateActionSchema` (bloqueio) |
| Repository | `repositories/management.repository.ts` | pousada gerida, reservas por pousada, availability (block/unblock) |
| Service | `features/gestao/services/pms.service.ts` | resolve pousada do dono (membership), reservas, calendário, bloqueio |
| Server Query | `server/queries.ts` → `getOwnerPousada`, `getOwnerReservations`, `getOwnerCalendar` | cache por request |
| Server Action | `features/gestao/actions.ts` | `blockDateAction`, `unblockDateAction` |
| Components | `reservations-calendar`, `owner-reservations-table`, `owner-reservations-view` | calendário interativo + tabela + shell |
| Páginas | `app/dashboard` (visão geral) e `app/dashboard/reservas` | dashboard real + gestão |

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

## Próximos passos

- Onboarding + aprovação da pousada pelo admin (substitui o vínculo manual).
- Acomodações (múltiplos quartos) e disponibilidade por quarto.
- Módulos financeiro e RH/funcionários.
- Bloquear reserva em datas indisponíveis (integrar `availability` ao fluxo do hóspede).

## Convite de equipe — aceitar / recusar (0049)

- `invite_membership` (0017) cria o vínculo como `invited`; a resposta é do
  PRÓPRIO convidado via `accept_membership_invite` / `decline_membership_invite`.
  `accept_membership_invite` existia desde a 0016 mas nada a chamava; a 0049
  a substitui (lock de linha, auditoria `member.invite_accepted`, retorno
  jsonb) e cria a recusa (`member.invite_declined`).
- Recusar vira `revoked` — o proprietário pode reconvidar depois (índice parcial da 0014).
- Onde aparece: tela "Convite pendente" (único vínculo é convite), tela de
  escolha de pousada (vários ativos) e faixa no topo do painel (já tem pousada
  ativa e recebeu convite de outra). Componente
  `features/membros/components/pending-invites.tsx`; dados via
  `getMyPendingInvites()` em `server/queries.ts`.
- Convite continua exigindo conta já existente com aquele e-mail e não envia
  e-mail (provedor ainda ausente) — quem convida precisa avisar a pessoa.
