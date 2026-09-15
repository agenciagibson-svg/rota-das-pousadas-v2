# Auditoria de Segurança — Rota das Pousadas

**Data:** 14/09/2026
**Escopo:** completo — código da aplicação (Server Actions, services, repositories, RBAC), banco (RLS, RPCs e grants das migrations 0001–0046), configuração (env, `proxy.ts`, `next.config.mjs`, `vercel.json`) e dependências.
**Base analisada:** `C:\Projeto Rota das Pousadas\extracted\rota-das-pousadas-main` (estado em disco, sem execução da aplicação nem do banco).
**Método:** revisão manual de código e SQL, com verificação cruzada entre as duas barreiras que a arquitetura define — RBAC na aplicação (`lib/auth/rbac.ts`) e RLS/RPC no Postgres. Todo achado abaixo foi confirmado lendo o arquivo citado; nenhum é inferência de nome de função.

---

## Resumo executivo

O projeto está **acima da média** em disciplina de segurança. A separação em duas barreiras é real, RLS está habilitada em **todas as 30 tabelas**, todas as 40+ funções `security definer` fixam `set search_path = public`, os grants a `anon` foram revisados explicitamente (migrations 0019 e 0035), os segredos server-only estão isolados (`'server-only'`, `lib/supabase/service.ts`), o webhook do Mercado Pago valida assinatura HMAC com comparação em tempo constante e **reconsulta o pagamento na origem** em vez de confiar no corpo, e `.env.local` **não está rastreado no git** (verificado no `.git/index`).

Dito isso, existe um padrão recorrente que gera os achados mais graves: **regras que só existem na camada de aplicação, em tabelas/RPCs que são alcançáveis diretamente pela API REST do Supabase** com a `anon key` (que é pública por definição, vai no bundle do navegador) + o JWT do próprio usuário. Onde isso acontece, a "primeira barreira" é a única barreira — e ela pode ser pulada.

| Severidade | Qtd | Tema |
|---|---|---|
| Crítico | 1 | Auto-concessão de acesso institucional |
| Alto | 3 | Preço de reserva confiado ao cliente; PII multi-tenant fora do modelo de concessão; CSP não aplicada |
| Médio | 6 | SSRF no iCal, XSS latente em JSON-LD, spam no formulário público, ausência de rate limiting, leitura de tokens de pagamento, reúso de chave criptográfica |
| Baixo | 7 | Replay de webhook, oráculo de convite, auditoria ampla, cron diário, state sem nonce, leitura pública de junções, inconsistência funcional no fluxo público |

**Veredicto:** não recomendo ir para produção com dinheiro real antes de corrigir o achado Crítico e os três Altos. Os demais podem entrar no plano do piloto.

### Status das correções (14/09/2026)

Os bloqueadores foram corrigidos no branch `fix/seguranca-bloqueadores`. A migration **0047 está aplicada no banco remoto** e verificada por consulta ao `pg_policies` e ao `information_schema`: nenhuma policy de `guests`, `quote_requests` ou `channel_calendars` referencia mais `auth_is_platform_admin()`; `platform_access_grants` tem só a policy de leitura e perdeu `INSERT`/`UPDATE`/`DELETE` para `anon` e `authenticated`; as quatro funções novas existem. **Falta o deploy da aplicação** e a validação funcional (reserva pública, adulteração de preço, concessão de acesso, console da CSP).

| Achado | Status | Onde |
|---|---|---|
| C-1 autoconcessão de grant | corrigido | `0047` (A) + `platform-access.repository.ts` |
| A-1 preço confiado ao cliente | corrigido | `0047` (D) |
| B-7 fluxo público travado | corrigido | `0047` (C) + `bookings.service.ts` |
| A-2 PII fora do modelo de concessão | corrigido | `0047` (B) e (B.2) |
| A-3 CSP não aplicada | corrigido (parcial por decisão) | `proxy.ts` — estrita com nonce em `/dashboard` e `/admin`; aplicada com `'unsafe-inline'` nas públicas |
| M-1 … B-6 | em aberto | plano abaixo |

A migration **0047** também levou junto dois itens que não dava para separar: `upsert_guest` (escrita de ficha de hóspede por qualquer papel de plataforma — fechar só a leitura seria meia correção) e um teto de 3 reservas `pending` abertas por viajante, que fecha o bloqueio de inventário descrito em A-1.

---

## Crítico

### C-1. Qualquer conta de plataforma pode se autoconceder acesso a reservas, pagamentos e despesas de todas as pousadas

**Onde:** `supabase/migrations/0013_platform_access_grants.sql:55-57`

```sql
create policy "grants_platform_manage" on platform_access_grants for all
  using (auth_is_platform_admin())
  with check (auth_is_platform_admin());
```

**O que acontece:** a migration 0013 existe justamente para tirar o acesso irrestrito de `platform_role` sobre `bookings`, `payments` e `expenses`, substituindo-o por uma concessão explícita, justificada e temporária. Mas a policy que controla a tabela de concessões aceita **qualquer** `platform_role` para `INSERT` — e `auth_is_platform_admin()` (0002:10-16) retorna verdadeiro para `platform_role is not null`, ou seja, também para `marketing`, `comercial`, `suporte` e `financeiro_plataforma`.

A restrição real ("só `master` gerencia concessões") vive apenas na matriz RBAC (`lib/auth/rbac.ts`, ação `platform:grant:manage`) — que é código de aplicação. O comentário do próprio arquivo diz "ninguém concede acesso a si mesmo silenciosamente", mas o banco não impõe isso.

**Impacto:** um usuário com o papel mais fraco da plataforma (ex.: `marketing`) faz, direto contra a API REST do Supabase com sua própria sessão:

```
POST /rest/v1/platform_access_grants
{ "pousada_id": "<qualquer>", "granted_to": "<ele mesmo>",
  "reason": "x", "expires_at": "2030-01-01" }
```

e a partir daí `auth_has_active_grant()` passa a retornar `true`, liberando leitura de **todas as reservas, todos os pagamentos e todas as despesas** daquela pousada — repetível para todas as pousadas. Todo o modelo de acesso institucional da 0013 é contornado, sem trilha de aprovação.

**Correção:**

1. Substituir a policy por escrita nenhuma e mover a criação/revogação para RPCs `security definer` que validem `platform_role = 'master'` e que proíbam `granted_to = auth.uid()`:

```sql
drop policy "grants_platform_manage" on platform_access_grants;

create policy "grants_platform_read" on platform_access_grants for select
  using (auth_is_platform_master() or granted_to = auth.uid());

create or replace function auth_is_platform_master()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p
                 where p.id = auth.uid() and p.platform_role = 'master');
$$;

create or replace function grant_platform_access(
  p_pousada_id uuid, p_granted_to uuid, p_reason text, p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not auth_is_platform_master() then
    raise exception 'Só a administração da plataforma concede acesso institucional.';
  end if;
  if p_granted_to = auth.uid() then
    raise exception 'Concessão a si mesmo não é permitida.';
  end if;
  if length(trim(coalesce(p_reason,''))) < 10 then
    raise exception 'Justifique a concessão.';
  end if;
  if p_expires_at > now() + interval '7 days' then
    raise exception 'Concessão limitada a 7 dias.';
  end if;
  insert into platform_access_grants(pousada_id, granted_to, granted_by, reason, expires_at)
  values (p_pousada_id, p_granted_to, auth.uid(), p_reason, p_expires_at)
  returning id into v_id;
  insert into audit_log(actor_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'platform.grant_created', 'platform_access_grants', v_id,
          jsonb_build_object('pousadaId', p_pousada_id, 'grantedTo', p_granted_to));
  return v_id;
end; $$;
revoke all on function grant_platform_access(uuid, uuid, text, timestamptz) from public, anon;
grant execute on function grant_platform_access(uuid, uuid, text, timestamptz) to authenticated;
```

2. Fazer o mesmo para a revogação, e ajustar `repositories/platform-access.repository.ts` para chamar as RPCs em vez de `insert`/`update` direto.

---

## Alto

### A-1. `create_booking` grava o preço que o cliente mandar

**Onde:** `supabase/migrations/0034_bookings_rpcs_and_rls.sql:229-234` (parâmetros) e `:305-312` (insert). O comentário em `:210-217` assume isso explicitamente: *"a RPC nunca recalcula preço"*.

**O que acontece:** `create_booking` recebe `p_subtotal`, `p_fee`, `p_discount`, `p_surcharge`, `p_services_amount` e `p_total` do chamador e os grava sem nenhuma conferência contra `rooms.base_price`. A RPC é concedida a `authenticated` (`:333`). O cálculo confiável (`features/reservas/pricing.ts` → `features/reservas/services/bookings.service.ts:54`) roda no servidor de aplicação, mas **o servidor de aplicação não é o único caminho até a RPC**: qualquer viajante logado pode chamar `/rest/v1/rpc/create_booking` com a `anon key` pública e o próprio JWT.

O mesmo vale para os outros parâmetros livres no fluxo público:

- `p_payment_due_at` — prazo de pagamento arbitrário. Uma reserva `pending` com vencimento em 2099 bloqueia o quarto indefinidamente (a expiração automática em `:285-296` só limpa pendências **vencidas**). Repetido em escala, é negação de serviço sobre o inventário de qualquer pousada publicada.
- `p_code` — código de reserva forjado ou colidente com outro.
- `p_internal_notes` / `p_special_requests` — texto arbitrário injetado na tela da equipe da pousada.
- `p_origin` / `p_external_channel_name` — reserva pública se passando por reserva de Airbnb/Booking, o que distorce o relatório do link da bio e a conciliação.

**Mitigação que existe hoje (frágil e acidental):** `p_responsible_guest_id` precisa ser um hóspede real daquela pousada, e `upsert_guest` (0043:43-45) exige acesso de staff — então um viajante comum não consegue criar o hóspede. Isso reduz a explorabilidade **agora**, mas é o mesmo detalhe que quebra o fluxo público de reserva (ver B-7): no momento em que esse fluxo for corrigido, o furo de preço fica aberto. As duas coisas têm que ser resolvidas na mesma mudança.

**Impacto:** reserva confirmada por valor arbitrário (R$ 0,01). A conciliação da 0042 só confirma quando `v_received >= v_booking.total` — mas `total` é exatamente o campo adulterado, então a checagem passa. Prejuízo direto para a pousada, não para a plataforma, o que torna o problema pior do ponto de vista do contrato com o cliente.

**Correção:** no ramo não-staff de `create_booking`, recalcular o preço no banco e ignorar o que veio do formulário:

```sql
if not v_is_staff then
  ...
  select base_price into v_nightly from rooms where id = p_room_id;
  v_nights   := p_checkout - p_checkin;
  v_subtotal := v_nightly * v_nights;
  if p_subtotal <> v_subtotal or p_total <> v_subtotal
     or coalesce(p_fee,0) <> 0 or coalesce(p_discount,0) <> 0
     or coalesce(p_surcharge,0) <> 0 or coalesce(p_services_amount,0) <> 0 then
    raise exception 'Valores da reserva divergentes do preço vigente.';
  end if;
  if p_origin <> 'rota_das_pousadas' or p_external_channel_name is not null then
    raise exception 'Origem inválida para reserva pública.';
  end if;
  p_internal_notes := '';
  p_code           := 'RP-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,6));
  p_payment_due_at := now() + interval '24 hours';
end if;
```

(ou, mais simples: para não-staff, não aceitar esses parâmetros — derivar todos dentro da RPC.)
Vale também adicionar um teto de reservas `pending` simultâneas por usuário, para fechar o vetor de bloqueio de inventário.

---

### A-2. PII de hóspedes e de leads fora do modelo de concessão temporária

**Onde:** `supabase/migrations/0030_guests.sql:90-94` e `0046_link_events_and_quotes.sql:94-97`

```sql
create policy "guests_read" on guests for select
  using (auth_has_guest_access(pousada_id) or auth_is_platform_admin());
```

**O que acontece:** a decisão do Ciclo 2 (0013) foi que `platform_role` sozinho não dá acesso a dado pessoal/financeiro de pousada — é preciso uma concessão justificada e temporária. Essa decisão cobriu `bookings`, `payments` e `expenses`, que existiam à época. As tabelas criadas depois **não herdaram a regra**:

- `guests` (0030) — a tabela com o dado mais sensível do sistema: `document_number`, `birth_date`, `address`, `cep`, `emergency_contact`, `dietary_restrictions`, `accessibility_needs`.
- `quote_requests` (0046) — nome, telefone, e-mail e mensagem livre de leads que nunca foram clientes.
- `channel_calendars` (0044:132) — inclui `export_token`, o segredo que dá acesso ao feed iCal de cada quarto.
- `pousada_payment_accounts` (0039:51) — ver M-5.

Em todas, `auth_is_platform_admin()` (qualquer `platform_role`, inclusive `marketing`) lê tudo de todos os tenants, direto pela API REST, sem registro nenhum.

**Impacto:** vazamento de base de CPFs/documentos e de contatos de hóspedes de todas as pousadas a partir de qualquer conta interna comprometida ou mal-intencionada — inclusive papéis que a própria matriz RBAC não autoriza a ver hóspede (`marketing`, `financeiro_plataforma`).

**Correção:** trocar `auth_is_platform_admin()` por `auth_has_active_grant(pousada_id)` nas policies de `guests`, `quote_requests` e `channel_calendars` (o grant já é a ferramenta certa, e o suporte legítimo continua funcionando via concessão). Para `channel_calendars`, o ideal é mover `export_token` para tabela própria sem policy de leitura — hoje um `admin_pousada` também consegue extrair todos os tokens da pousada via REST.

---

### A-3. CSP publicada apenas em Report-Only, e com `'unsafe-inline'`

**Onde:** `proxy.ts:49` e `proxy.ts:35`

```ts
response.headers.set('Content-Security-Policy-Report-Only', contentSecurityPolicy())
...
"script-src 'self' 'unsafe-inline'",
```

**O que acontece:** o header está no modo que **só reporta** — nenhuma violação é bloqueada. E mesmo se fosse promovido hoje, `script-src 'unsafe-inline'` anula a proteção contra XSS refletido/armazenado, que é exatamente o que a CSP existe para conter (o próprio comentário reconhece: "migrar scripts para nonce/`strict-dynamic`"). Não há também `report-uri`/`report-to`, então as violações não estão sendo coletadas em lugar nenhum — o rollout "seguro" não está gerando o dado que justificaria promover o header.

Os demais cabeçalhos (`X-Frame-Options: DENY`, `nosniff`, HSTS com preload, `Referrer-Policy`, `Permissions-Policy`) estão corretos.

**Impacto:** a plataforma tem conteúdo controlado por terceiros (descrição de pousada, mensagem de orçamento, notas internas) renderizado em páginas públicas e no painel. Sem CSP aplicada, qualquer falha de escape vira execução de script — e existe uma candidata latente já no código (M-2).

**Correção:**

1. Adicionar `report-to`/`report-uri` e coletar por ~1 semana em staging/produção.
2. Migrar para nonce por requisição (gerar no `proxy.ts`, propagar via header e usar em `<script nonce>`), remover `'unsafe-inline'` de `script-src` e adicionar `'strict-dynamic'`.
3. Renomear o header para `Content-Security-Policy`.
4. `style-src 'unsafe-inline'` pode ficar por enquanto (Tailwind/Next), mas registre a dívida.

---

## Médio

### M-1. SSRF na importação de calendários iCal

**Onde:** `features/canais/services/sync.service.ts:29-45`

A URL do feed é fornecida pelo tenant (`features/canais/schemas.ts:15-21` exige apenas `https://`) e é buscada pelo servidor com `redirect: 'follow'`, sem validação de destino. Um proprietário pode apontar o canal para um host próprio que responde `302` para `http://169.254.169.254/...`, para `http://localhost:*` ou para um serviço interno — o `fetch` do Node segue redirecionamentos entre protocolos. Os limites de tamanho (2 MB) e timeout (15 s) estão corretos, mas não restringem destino.

O retorno também vaza: `messageOf()` corta o erro em 300 caracteres e a mensagem é gravada em `last_sync_error` e exibida na tela do canal — status HTTP e trechos de erro de hosts internos ficam visíveis para quem configurou o feed.

**Correção:** resolver o DNS antes do `fetch`, rejeitar IPs privados/loopback/link-local/CGNAT (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fc00::/7`), usar `redirect: 'manual'` e revalidar cada salto com a mesma regra (máx. 2 saltos), e normalizar a mensagem de erro exposta ao usuário para um conjunto fechado ("feed não respondeu", "formato inválido"), guardando o detalhe só no log do servidor.

### M-2. XSS latente em `JsonLd`

**Onde:** `components/seo/json-ld.tsx:11`

```tsx
dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
```

`JSON.stringify` não escapa `<` nem `/`. Como o payload de `pousadaJsonLd()` (`lib/seo.ts:100-124`) carrega `pousada.name` e `pousada.description` — texto editável pelo proprietário —, uma descrição contendo `</script><script>…` escapa do bloco e executa na página pública.

**Hoje não é explorável, mas o componente está em uso.** `app/layout.tsx:35` renderiza `<JsonLd data={organizationJsonLd()} />` em todas as páginas — e `organizationJsonLd()` (`lib/seo.ts:126-135`) só monta constantes de `siteConfig`, sem nenhuma entrada de usuário. O caminho perigoso é `pousadaJsonLd()`, que ainda não é renderizado em lugar nenhum. Ou seja: a injeção está armada para o dia em que o SEO estruturado por pousada for ligado.

*(Correção de uma afirmação da primeira versão deste relatório, que dizia que `JsonLd` não era usado em página alguma — a busca havia rodado antes de `app/layout.tsx` estar disponível para leitura. A conclusão de severidade não muda.)*

**Correção:** escapar antes de injetar — `JSON.stringify(data).replace(/</g, '\\u003c')` — ou usar `<script type="application/ld+json">{JSON.stringify(data)}</script>` sem `dangerouslySetInnerHTML`.

### M-3. Formulário público de orçamento sem contenção real de abuso

**Onde:** `supabase/migrations/0046_link_events_and_quotes.sql:175-181`

O limite é de 3 pedidos por **telefone** por pousada por hora. Trocar um dígito do telefone zera o limite. `create_quote_request` é concedida a `anon`, aceita `message` de até 2000 caracteres e não tem CAPTCHA nem limite por IP.

**Impacto:** inundação da caixa de pedidos da pousada (o próprio comentário reconhece que isso faz a pousada parar de olhar os pedidos reais), crescimento não controlado da tabela e injeção de PII falsa. `record_link_event` tem o mesmo perfil: cap de 300/min por pousada, mas cada chamada faz um `count(*)` sobre a janela — o custo é assumido mesmo pelas chamadas descartadas.

**Correção:** colocar Turnstile/hCaptcha no formulário da bio e validar o token dentro da Server Action antes de chamar a RPC; adicionar limite por IP na borda (Vercel WAF / middleware); e indexar `link_events(pousada_id, created_at)` se ainda não estiver, para o cap não virar o gargalo.

### M-4. Sem rate limiting próprio em autenticação e Server Actions

`features/auth/actions.ts` expõe login, login admin e cadastro sem nenhum controle de tentativas na aplicação — a contenção é só a do Supabase Auth (padrão da plataforma, não ajustada aqui). `signInAdminAction` é especialmente relevante: ela autentica primeiro e só depois checa `platformRole`, então serve como oráculo de senha válida para contas sem acesso administrativo.

**Correção:** limite por IP + por e-mail na borda, e atraso/bloqueio progressivo após N falhas. Revisar os limites do Supabase Auth no painel antes do piloto.

### M-5. Tokens de pagamento legíveis por perfis que não precisam deles

**Onde:** `supabase/migrations/0039_payment_accounts_and_rpcs.sql:50-51`

A policy permite `select` da tabela inteira — incluindo `access_token` e `refresh_token` cifrados — para `auth_can_manage_pousada` (proprietário **e** `admin_pousada`) e para qualquer `platform_role`. O comentário logo acima diz "ninguém mais deve nem saber que existe uma conexão", mas a policy é mais larga do que isso.

Os tokens estão cifrados com AES-256-GCM e a chave vive fora do banco (`lib/crypto/token-cipher.ts`), o que segura o impacto — é defesa em profundidade funcionando. Ainda assim, não há motivo para expor o ciphertext.

**Correção:** mover `access_token`/`refresh_token`/`public_key` para uma tabela irmã sem policy de leitura (acesso só pelas RPCs `service_role`), deixando na tabela consultável apenas `connected`, `live_mode`, `mp_user_id` e `expires_at` — que é exatamente o que `getOwnerPaymentAccountStatus()` usa.

### M-6. Uma chave para dois propósitos criptográficos

**Onde:** `lib/crypto/token-cipher.ts:18` e `features/pagamentos/services/oauth-state.ts:22`

`PAYMENT_TOKENS_ENCRYPTION_KEY` é usada tanto como material de cifra AES-GCM (via `scryptSync` com salt fixo) quanto como chave HMAC-SHA256 do `state` do OAuth. Reúso de chave entre primitivas diferentes é má higiene: qualquer rotação passa a exigir coordenar dois domínios, e um vazamento do segredo de assinatura compromete também os tokens do Mercado Pago.

Observação de desempenho com reflexo operacional: `scryptSync` roda a cada `encryptToken`/`decryptToken` — no caminho do webhook, isso é latência desnecessária.

**Correção:** variável separada (`OAUTH_STATE_SIGNING_KEY`) e derivação de chave em cache de módulo. Documentar o procedimento de rotação de ambas.

---

## Baixo

### B-1. Webhook sem verificação de frescor do `ts`
`features/pagamentos/services/webhook.service.ts:40-50` valida o HMAC mas não confere se `ts` é recente. Uma notificação capturada pode ser reenviada indefinidamente. O impacto é contido porque `reconcile_marketplace_payment` (0042:55-66) é idempotente por `provider_ref` + `provider_updated_at` e distingue `stale`/`already_recorded`. **Correção:** rejeitar `|now − ts| > 5 min`.

### B-2. `invite_membership` ainda permite confirmar existência de conta
`supabase/migrations/0017_find_profile_by_email_fn.sql:55-62` retorna `processed` tanto para e-mail existente quanto inexistente — a resposta é neutra, como documentado. Mas o efeito colateral não é: quando a conta existe, uma linha `invited` aparece na equipe. Um proprietário testa e-mails e lê a resposta na própria tela de equipe. O oráculo está restrito a proprietários (não a qualquer autenticado, como na versão anterior), então é bem menos grave. **Correção:** limitar convites por hora e auditar cada tentativa, ou exigir confirmação por e-mail antes de a linha aparecer.

### B-3. `audit_log` legível por qualquer papel de plataforma
`supabase/migrations/0002_rls.sql:172` — `marketing` e `comercial` leem a trilha de auditoria completa, incluindo metadados de reservas e pagamentos de todos os tenants. A escrita está corretamente fechada (só `service_role`). **Correção:** restringir a leitura a `master` + `suporte`, ou ao modelo de grant.

### B-4. Cron de canais roda 1×/dia, contra os 15 minutos assumidos no código
`vercel.json` agenda `0 6 * * *`, enquanto `features/canais/services/sync.service.ts:82-86` justifica a execução sequencial dizendo que "a rodada roda a cada 15 minutos". Na prática, a janela em que uma venda no Airbnb ainda não bloqueou o quarto na Rota é de até 24 h — risco de overbooking, que é justamente o problema que a feature existe para resolver. Some-se que a rodada é sequencial com `maxDuration = 60`: com dezenas de feeds a 15 s de timeout cada, a função é cortada no meio e os canais do fim da fila nunca sincronizam (sem erro visível). **Correção:** `*/15 * * * *`, e paralelismo limitado (ex.: 5 por vez) com paginação da fila entre execuções.

### B-5. `state` do OAuth não é de uso único
`features/pagamentos/services/oauth-state.ts:27-33` — o `nonce` é gerado mas não é armazenado nem consumido, então um `state` válido pode ser reapresentado dentro dos 10 minutos. O callback revalida o membership real do usuário logado (`oauth.service.ts:44-53`), o que segura o impacto. **Correção:** registrar o nonce (tabela ou cache) e invalidar no primeiro uso.

### B-6. Junções de pousada com leitura totalmente pública
`supabase/migrations/0002_rls.sql:125` e `:130` — `pousada_experiences` e `pousada_amenities` usam `using (true)`, expondo os vínculos de pousadas ainda em rascunho/não publicadas (as demais tabelas filhas condicionam corretamente a `status = 'publicada'`). Vazamento leve de pipeline comercial. **Correção:** alinhar ao padrão de `rooms_read`.

### B-7. O fluxo público de reserva está bloqueado pela própria RPC de hóspedes
`features/reservas/services/bookings.service.ts:58-64` chama `upsertGuestRpc` com a sessão do viajante, mas `upsert_guest` (`0043_add_cep.sql:43-45`) exige `auth_has_guest_access(p_pousada_id)` — que só é verdadeiro para `proprietario`/`admin_pousada`/`recepcionista`. Um viajante comum recebe "Você não tem permissão para gerenciar hóspedes nesta pousada" e a reserva pública não completa, ainda que `create_booking` tenha um ramo explícito para o "fluxo público".

Não é uma vulnerabilidade — é uma inconsistência funcional. Está aqui porque é **a mitigação acidental do achado A-1**: ao corrigir este fluxo (por exemplo, permitindo que o próprio viajante crie/atualize apenas o registro de hóspede vinculado ao seu `user_id`), o furo de preço passa a ser explorável. Corrija os dois juntos.

---

## O que está bem resolvido

Vale registrar, porque é incomum encontrar este nível:

- **RLS universal.** 30 tabelas criadas, 30 com `enable row level security`. Nenhuma escapou.
- **`search_path` fixado** em 100% das funções `security definer` — fecha o vetor clássico de sequestro de função em `SECURITY DEFINER`.
- **Grants a `anon` revisados explicitamente** (0019 e 0035 existem só para isso), com `revoke ... from public` antes de cada `grant`. As únicas RPCs anônimas são catálogo público e as duas portas da página da bio.
- **Escrita de dado sensível só por RPC.** `bookings`, `memberships`, `guests`, `room_blocks`, `channel_calendars` e `pousada_payment_accounts` não têm policy de escrita direta — a regra de negócio foi reimplementada no Postgres, não apenas na aplicação.
- **Webhook do Mercado Pago.** Assinatura HMAC com `timingSafeEqual`, reconsulta do pagamento na API da origem (`mp-client.ts:169`), conferência de `external_reference` contra o `bookingId` da notificação, validação do payload por Zod, idempotência por `provider_ref` com lock consultivo e detecção de evento obsoleto (0042).
- **Segredos.** `service_role` isolada em `lib/supabase/service.ts` com uso restrito e documentado a dois chamadores; tokens de terceiros cifrados em AES-256-GCM com chave fora do banco; `.env.local` não rastreado no git (verificado no índice).
- **Cron protegido** com `timingSafeEqual` e falha fechada quando `CRON_SECRET` não está configurado.
- **Fail-closed no iCal**: feed com erro preserva os bloqueios existentes em vez de liberar quarto.
- **Feed iCal público sem PII** e sem oráculo de token (404 uniforme), com `X-Robots-Tag: noindex`.
- **Dependências** atualizadas e sem pacote notoriamente vulnerável na lista direta (Next 16.2.6, `@supabase/ssr` 0.5.2, Zod 3.24). Ainda assim, rode `pnpm audit --prod` no CI — a análise aqui foi do manifesto, não do lockfile resolvido.

---

## LGPD — pontos que exigem decisão antes do piloto

1. **Dado pessoal sensível.** `guests.dietary_restrictions` e `guests.accessibility_needs` são, na prática, dado de saúde (art. 5º, II da LGPD). Hoje são texto livre legível por qualquer `platform_role` (A-2). Precisam de base legal explícita e do acesso restrito.
2. **`guests.document_number` em claro.** CPF/RG sem cifra em coluna. Considere cifrar em repouso (mesma abordagem do `token-cipher`) ou, no mínimo, restringir por coluna via view + RPC.
3. **Leads do formulário público.** `quote_requests` coleta nome, telefone, e-mail e mensagem livre sem checkbox de consentimento e sem política de retenção. Falta: aviso de privacidade no formulário, prazo de expurgo (ex.: 12 meses) e um caminho de exclusão a pedido do titular.
4. **`link_events`.** O comentário diz que não grava nada identificável, e isso confere (só pousada, evento, datas, nº de hóspedes) — bom. Mantenha assim.
5. **Retenção de auditoria.** `audit_log` cresce indefinidamente e guarda `metadata` livre, incluindo valores. Defina prazo e expurgo.

---

## Plano sugerido

**Antes de qualquer pousada real transacionar:**

1. C-1 — fechar escrita em `platform_access_grants` e mover para RPC (meio dia).
2. A-1 + B-7 — recalcular preço no banco no ramo público e liberar o cadastro de hóspede do viajante, na mesma mudança (1 dia).
3. A-2 — trocar `auth_is_platform_admin()` por `auth_has_active_grant()` em `guests`, `quote_requests` e `channel_calendars` (meio dia).
4. A-3 — coletar violações de CSP e promover o header (1–2 dias, com a migração para nonce).

**Durante o piloto:**

5. M-1 (SSRF), M-3 (CAPTCHA), M-4 (rate limiting), B-4 (cron a cada 15 min).
6. M-5 (separar tabela de tokens), M-6 (chave dedicada), M-2 (escapar JSON-LD antes de usá-lo).

**Backlog:**

7. B-1, B-2, B-3, B-5, B-6 e os itens de LGPD.

---

## Limites desta avaliação

- Análise **estática**: nenhum teste foi executado contra o banco ou a aplicação. Os achados de RLS/RPC foram derivados das migrations em disco — vale confirmar contra o schema realmente aplicado (`supabase db diff`), sobretudo porque vários arquivos trazem a nota "nunca aplicado a um banco real — correção feita in place".
- Não houve teste dinâmico (nenhuma requisição enviada, nenhum payload testado). As reproduções descritas são derivadas do código, não observadas.
- Fora de escopo: configuração do projeto Supabase no painel (políticas de senha, limites do Auth, expiração de JWT, regras de Storage além da 0037), configuração da Vercel (WAF, proteção de deploy previews, variáveis de ambiente por ambiente) e histórico do git além do índice atual.
- `node_modules` e o lockfile não foram auditados por CVE; o `pnpm audit` no CI continua necessário.
