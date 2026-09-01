# Feature: Onboarding de Pousada + Aprovação (Admin)

Cadastro de pousada pelo proprietário (entra **em análise**) e aprovação pela
equipe da plataforma. Fecha o acesso ao painel admin (RBAC por papel de plataforma).

## Camadas

| Camada | Arquivo | Papel |
|---|---|---|
| RPC (DB) | `supabase/migrations/0005_create_pousada_fn.sql` | cria pousada+quarto+membership atômico (SECURITY DEFINER) |
| Slug | `lib/slug.ts` | slug URL-safe único (testado) |
| Schemas | `features/onboarding/schemas.ts`, `features/admin/schemas.ts` | Zod (cadastro, id) |
| Service | `features/onboarding/services/onboarding.service.ts`, `features/admin/services/admin.service.ts` | criar pousada; listar/aprovar/rejeitar (RBAC) |
| Server Query | `getPendingPousadas`, `isPlatformAdmin` | leitura admin |
| Actions | `createPousadaAction`, `approvePousadaAction`, `rejectPousadaAction` | mutações (Zod → ActionResult) |
| UI | `create-pousada-form`, `admin-view`, `pending-pousadas` | formulário + painel admin real |
| Páginas | `app/anunciar`, `app/admin` (gate) | cadastro + admin |

## Fluxo

```mermaid
flowchart TD
    O[Proprietário] -->|/anunciar| F[Formulário RHF+Zod]
    F --> A[createPousadaAction] --> RPC[(RPC create_pousada)]
    RPC --> S[Pousada em_analise + quarto + membership]
    S --> D[Dashboard: banner "Em análise"]
    ADM[Equipe plataforma] -->|/admin| G{platform_role?}
    G -->|não| R[redirect /dashboard]
    G -->|sim| P[Aprovações pendentes]
    P -->|Aprovar| PUB[status = publicada → vai ao ar]
    P -->|Rejeitar| REP[status = reprovada]
```

## Segurança / acesso

- **/admin fechado**: `app/admin` redireciona quem não tem `platform_role`.
- **Aprovar/rejeitar**: só papéis com `pousada:approve` (comercial/master) — RBAC
  no service + RLS `auth_is_platform_admin()` no banco (dupla barreira).
- **Cadastro**: RPC `SECURITY DEFINER` resolve o ovo-galinha da RLS (o usuário
  ainda não é membro ao criar a 1ª membership); `owner_id`/`user_id` vêm de
  `auth.uid()`, nunca do cliente.
- Pousada nasce `em_analise` — invisível no catálogo público até aprovação (RB-01).

## Setup de banco (rodar no Supabase)

1. `supabase/migrations/0005_create_pousada_fn.sql` (função de cadastro).
2. Para testar o admin, promover um usuário a plataforma:
   ```sql
   update profiles set platform_role = 'master'
   where id = (select id from auth.users where email = 'EMAIL');
   ```

## Próximos passos

- Motivo da rejeição (coluna + exibição) e auditoria (`audit_log`).
- Endurecer RLS: impedir owner de setar `status='publicada'` (trigger).
- Upload de fotos da pousada (Supabase Storage) no cadastro.
