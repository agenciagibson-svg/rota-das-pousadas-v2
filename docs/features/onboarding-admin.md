# Feature: Onboarding de Pousada + Aprovação (Admin)

Cadastro de pousada pelo proprietário (entra **em análise**) e aprovação pela
equipe da plataforma. Fecha o acesso ao painel admin (RBAC por papel de plataforma).

## Camadas

| Camada       | Arquivo                                                                                          | Papel                                                     |
| ------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| RPC (DB)     | `supabase/migrations/0005_create_pousada_fn.sql`                                                 | cria pousada+quarto+membership atômico (SECURITY DEFINER) |
| Slug         | `lib/slug.ts`                                                                                    | slug URL-safe único (testado)                             |
| Schemas      | `features/onboarding/schemas.ts`, `features/admin/schemas.ts`                                    | Zod (cadastro, id)                                        |
| Service      | `features/onboarding/services/onboarding.service.ts`, `features/admin/services/admin.service.ts` | criar pousada; listar/aprovar/rejeitar (RBAC)             |
| Server Query | `getPendingPousadas`, `isPlatformAdmin`                                                          | leitura admin                                             |
| Actions      | `createPousadaAction`, `approvePousadaAction`, `rejectPousadaAction`                             | mutações (Zod → ActionResult)                             |
| UI           | `create-pousada-form`, `admin-view`, `pending-pousadas`                                          | formulário + painel admin real                            |
| Páginas      | `app/anunciar`, `app/admin` (gate)                                                               | cadastro + admin                                          |

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
- **Colunas de controle** (0065): o trigger `trg_guard_pousada_owner_changes`
  só deixa o dono alterar as colunas das Configurações. Publicação (`status`),
  situação da conta, dono, nota e contagem de avaliações, destino e slug ficam
  com a equipe comercial/master, mesmo chamando a API do Supabase direto; e
  pousada criada pelo dono precisa nascer em análise.

## Setup de banco (rodar no Supabase)

1. `supabase/migrations/0005_create_pousada_fn.sql` (função de cadastro).
2. Para testar o admin, promover um usuário a plataforma:
   ```sql
   update profiles set platform_role = 'master'
   where id = (select id from auth.users where email = 'EMAIL');
   ```

## Cadastro rápido pelo admin + vincular proprietário

Segundo caminho de onboarding, direto do painel `/admin` (equipe comercial/master
cadastra a pousada usando o Instagram como referência, sem o dono precisar ter
conta ainda) — em paralelo ao fluxo `/anunciar` acima.

| Camada     | Arquivo                                                                         | Papel                                                     |
| ---------- | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Repository | `repositories/pousadas.repository.ts` (`insertPousadaAsAdmin`)                  | insert direto em `pousadas`, sem RPC — **sem membership** |
| RPC (DB)   | `supabase/migrations/0052_link_pousada_owner.sql`                               | vincula e-mail já cadastrado como proprietário `active`   |
| Schema     | `features/admin/schemas.ts` (`linkPousadaOwnerSchema`)                          | Zod (pousadaId + e-mail)                                  |
| Service    | `features/admin/services/admin.service.ts` (`linkPousadaOwner`, `canLinkOwner`) | RBAC `pousada:link_owner`                                 |
| Action     | `features/admin/actions.ts` (`linkPousadaOwnerAction`)                          | mutação                                                   |
| UI         | `features/admin/components/link-pousada-owner.tsx`                              | botão + mini-formulário na tela "Pousadas"                |

Diferente do `/anunciar`, o cadastro pelo admin (`createPousadaAsAdmin`) **não
cria nenhuma membership** — a pousada nasce órfã (achado da avaliação de
painéis de 15/09/2026). `link_pousada_owner` (0052) fecha esse buraco: exige
que o e-mail informado já tenha conta na plataforma e cria a membership
`proprietario` já `active` (não `invited` — quem chama é comercial/master,
que já validou o dono fora do sistema). Autorização: `pousada:link_owner`
(comercial/master) no app + `auth_can_manage_pousadas_platform()` (0051) no
banco, as duas barreiras espelhando o mesmo par de papéis.

A tabela "Pousadas" mostra "Vincular proprietário" só para quem tem
`pousada:link_owner` e só quando a pousada ainda não tem `ownerName`
(`listAllPousadasForAdmin`). Não impede múltiplos proprietários por pousada
(sócios) — só duplicar o mesmo usuário na mesma pousada, via índice parcial
da 0014.

## Próximos passos

- Motivo da rejeição (coluna + exibição) e auditoria (`audit_log`).
- Upload de fotos da pousada (Supabase Storage) no cadastro.
