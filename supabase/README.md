# Supabase — Banco de dados e RLS

Infra de dados versionada. **Ainda não conectada** (aguardando credenciais).

## Conteúdo

```
supabase/
├── migrations/
│   ├── 0001_init.sql   # schema (tabelas, enums, índices, multi-tenant)
│   └── 0002_rls.sql    # Row Level Security: funções + policies
└── seed.sql            # dados de referência (destinos/experiências/amenities)
```

## Como plugar (quando houver projeto Supabase)

1. Criar o projeto no Supabase e copiar as chaves para `.env.local`
   (ver `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. Aplicar as migrations (CLI):
   ```bash
   supabase link --project-ref <ref>
   supabase db push          # aplica migrations/*.sql
   psql "$DATABASE_URL" -f supabase/seed.sql   # opcional: dados de referência
   ```
3. Gerar os tipos e substituir o placeholder:
   ```bash
   supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
   ```
4. A partir daí, `isSupabaseConfigured()` passa a `true` e os Repositories
   trocam automaticamente da implementação mock para a Supabase — **sem alterar
   Services, Server Queries ou UI**.

## Princípios

- **Multi-tenant:** a pousada é a fronteira de tenant; tabelas de oferta têm
  `pousada_id`. As policies garantem que dados de uma pousada nunca vazam.
- **Dupla barreira:** RBAC na aplicação (`lib/auth/rbac.ts`) + RLS no banco.
- **Auditoria:** escrita em `audit_log` apenas via service role (server-side).
- **Idempotência:** webhooks de pagamento devem usar `provider_ref` como chave.
- **SELECT por coluna em `pousadas`, `reviews`, `bookings` e `guests`:** a API
  não lê colunas privadas (0084) nem o contato do hóspede (0105). Coluna nova
  nessas tabelas precisa de `grant select (coluna) on public.<tabela> to anon,
authenticated;` na própria migration; `supabase/tests/contato-0105.sql` falha
  se faltar em `bookings`/`guests`.
