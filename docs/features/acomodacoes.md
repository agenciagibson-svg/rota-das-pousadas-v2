# Feature: Acomodações (PMS)

Gestão de quartos/acomodações da pousada pelo proprietário. Cada pousada nasce
com uma acomodação padrão; aqui o dono adiciona, lista e remove quartos.

## Camadas

| Camada | Arquivo | Papel |
|---|---|---|
| Types | `features/acomodacoes/types.ts` | `ManagedRoom` |
| Schemas | `features/acomodacoes/schemas.ts` | `createRoomSchema`, `roomIdSchema` (Zod) |
| Repository | `repositories/rooms.repository.ts` | `listRoomsByPousada`, `insertRoom`, `deleteRoom` |
| Service | `features/acomodacoes/services/rooms.service.ts` | resolve pousada do dono; add/list/remove (guarda de FK) |
| Server Query | `server/queries.ts` → `getOwnerRooms` | cache por request |
| Server Actions | `features/acomodacoes/actions.ts` | `createRoomAction`, `deleteRoomAction` |
| UI | `rooms-view`, `room-form` | lista + form + remover (Design System) |
| Página | `app/dashboard/acomodacoes` | painel de acomodações |

## Regras

- Quartos pertencem à pousada do usuário (resolvida por membership).
- **Remoção protegida**: não é possível excluir um quarto com reservas
  (FK `bookings.room_id`); o service traduz o erro em mensagem amigável.
- A reserva do hóspede usa a acomodação mais barata (menor `base_price`) — a
  seleção de quarto específico pelo hóspede é um próximo passo.

## Segurança

- Tabela `rooms` com RLS: leitura pública quando a pousada está publicada;
  escrita apenas por quem gerencia a pousada (`auth_can_manage_pousada`).

## Próximos passos

- Editar quarto (não só add/remove).
- Seleção de quarto no fluxo de reserva do hóspede.
- Fotos por acomodação (Supabase Storage) e comodidades por quarto.
