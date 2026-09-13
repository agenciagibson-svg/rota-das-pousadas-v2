# Piloto com cliente real — plano revisado

Documento de execução. Não substitui `docs/Architecture.md`, `AI_RULES.md` nem
`docs/04_BUSINESS_ARCHITECTURE.md`, que continuam sendo lei técnica.

> **Revisão de 13/09/2026.** A primeira versão deste plano tratou as pendências
> "Alta" de `docs/ANALISE-2026-09-11.md` como abertas. Conferência no código
> mostrou que **já foram fechadas** pelas migrations `0041`/`0042` e pela
> reescrita de `mp-client.ts` e `webhook.service.ts`, todas do mesmo dia da
> análise. A análise descreve o estado *antes* dessas correções. O plano abaixo
> parte do código real, e o prazo caiu.

## 1. O que a análise listava como pendente e já está resolvido

| Pendência listada                                        | Onde foi fechada                                                                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Busca pública ignora disponibilidade e capacidade        | `0041`: `search_public_pousadas` e `list_bookable_rooms` filtram por check-in/check-out e hóspedes, excluindo reservas `pending/confirmed/checked_in` e bloqueios ativos. `app/pousadas/page.tsx` já envia os filtros via `catalogQuerySchema`. |
| Idempotência cega por `provider_ref`                     | `0042`: `reconcile_marketplace_payment` versiona por `provider_updated_at` e distingue `stale`, `already_recorded` e eventos divergentes para a mesma versão. O endpoint antigo foi revogado na própria migration. |
| Confirmação sem conferir valor recebido                  | `0042`: valida moeda contra a reserva e contra `'BRL'`, rejeita valor divergente para o mesmo `provider_ref`, calcula `v_received` com crédito e estorno, e só confirma se `v_received >= total`.                  |
| Concorrência no pagamento                                | `0042`: `pg_advisory_xact_lock` por `provider_ref` + `for update` na reserva, com ordem de locks fixa e documentada.                                                                                              |
| `mp-client.ts` sem timeout nem validação de schema       | Reescrito: `AbortSignal.timeout(10000)` em todas as chamadas, `mpPaymentSchema` (Zod) na resposta, re-busca do pagamento por ID sem confiar no corpo do webhook.                                                  |
| Assinatura do webhook                                    | `webhook.service.ts`: HMAC-SHA256 do manifest oficial com `timingSafeEqual`, e conferência de `external_reference` contra o `bookingId`.                                                                           |
| Paginação instável do catálogo                           | `0041`: `order by slug` com `limit/offset` e total calculado na mesma CTE; índice parcial para o filtro público.                                                                                                   |
| Escape do texto de busca                                 | `0041`: `catalog_search_text` normaliza acentos e o match é por `strpos`, sem concatenar texto do usuário em filtro.                                                                                               |

Ou seja: **não há trabalho de construção pendente no caminho do pagamento nem da
busca.** O que falta é de outra natureza — ver §2.

## 2. O que de fato falta para um cliente real

### 2.1 Sincronização iCal com OTA — *ausente no código*

Não existe nada de canais no projeto: nenhum módulo `canais`, nenhuma rota de
iCal, nenhuma tabela de calendário externo. Se a pousada do piloto vende em
Booking/Airbnb, este é o único item que ainda precisa ser **construído**, e é o
que pode matar o piloto (overbooking na primeira semana).

Seguindo a ordem obrigatória (schemas → types → repository → service → query →
action → components → página → testes → docs):

1. **Migration `0044_channel_calendars.sql`**
   - `channel_calendars`: `tenant_id`, `pousada_id`, `room_id`, `provider`
     (`airbnb` | `booking` | `outro`), `ical_url`, `direction`, `last_sync_at`,
     `last_status`, `etag`, auditoria, RLS por `tenant_id`.
   - `channel_events`: `tenant_id`, `calendar_id`, `room_id`, `uid`, `dtstart`,
     `dtend`, `raw_hash`; índice `(room_id, dtstart, dtend)`.
   - RPC `sync_channel_events`: upsert por `uid`, remoção do que saiu do feed,
     tudo em uma transação — mesmo rigor de `0042`.
2. **Import**: rota de cron protegida por segredo, Vercel Cron a cada 15 min,
   `fetch` com `AbortSignal.timeout`, parse de `VEVENT`, gravação transacional.
3. **Export**: rota pública por token assinado, um feed por quarto, contendo
   apenas `DTSTART`/`DTEND`/`UID` e `SUMMARY: Reservado` — **sem nome, telefone,
   e-mail ou valor** (link de calendário é URL pública por natureza).
4. **`list_bookable_rooms` e `availability-engine.ts` passam a considerar
   `channel_events`** junto com reservas e bloqueios, mantendo o comportamento
   *fail-closed* já corrigido: leitura que falha **não** libera quarto.
5. Tela em `dashboard/acomodacoes`: colar o link iCal por quarto, ver último
   sincronismo e erro legível.

**Aceite:** bloqueio criado no Airbnb aparece na Rota em ≤15 min; reserva criada
na Rota aparece no calendário da OTA no ciclo dela; feed exportado validado por
um leitor iCal; falha de rede não libera quarto; parse testado com arquivos
reais de Airbnb e Booking.

### 2.2 Executar o que já está escrito — *código correto ≠ código provado*

A própria análise diz: *"Não foram executadas transações reais, testes de carga,
navegação autenticada ou validação das policies em um Supabase isolado. Esta
análise não certifica produção."* Os testes de pagamento usam respostas
simuladas na fronteira do Supabase. Isso é **um dia de trabalho**, não semanas:

1. Rodar `supabase/tests/priorities.sql` e `concurrent-booking.sql` contra
   Postgres de verdade: duas pousadas com tentativas cruzadas, duas reservas
   simultâneas no mesmo quarto.
2. Sandbox do Mercado Pago (já configurado, `MERCADO_PAGO_TEST_MODE=true`) com
   cartões de teste, percorrendo pendente → aprovado → estornado, recusado,
   expirado e webhook duplicado fora de ordem — conferindo que `0042` devolve
   `stale` / `already_recorded` / `ok` como esperado.
3. Navegação autenticada ponta a ponta: dono, recepção e governança.

### 2.3 Infraestrutura de produção

1. Projeto Supabase **separado para produção**, 43 migrations aplicadas do zero
   e schema comparado com desenvolvimento.
2. PITR ativo e **uma restauração testada antes de entrar dado real**.
3. Sentry — previsto no `.env.example` mas ausente das dependências; alerta para
   falha de reserva, de pagamento e de auditoria.
4. Domínio, HTTPS, `NEXT_PUBLIC_SITE_URL`; conferir que
   `SUPABASE_SERVICE_ROLE_KEY` não chega ao bundle do client.
5. `MERCADO_PAGO_TEST_MODE` removido só no momento de abrir para dinheiro real.

### 2.4 Conformidade e suporte

- Termos de uso, política de privacidade e contrato do piloto por escrito
  (mesmo gratuito): prazo, escopo, suporte, e o destino dos dados se acabar.
- LGPD: base legal, retenção, exportar e apagar dados do hóspede.
- Ficha de registro de hóspedes (FNRH) — conferir os campos obrigatórios que a
  pousada preenche hoje contra a ficha do sistema.
- Canal de suporte com resposta acordada e plano de contingência escrito.

### 2.5 Ponto que precisa de decisão sua — `marketplace_fee`

`createCheckoutPreference` envia `marketplace_fee` (comissão da plataforma) na
preferência do Checkout Pro. Isso contradiz `docs/04_BUSINESS_ARCHITECTURE.md` e
o modelo registrado: **Rota é SaaS por assinatura, não cobra comissão sobre
reserva e nunca custodia fundos.** Com `marketplace_fee > 0` a Rota vira parte
da transação, o que reabre a discussão regulatória que o modelo evita de
propósito. Se a comissão não é para existir, o campo deve ir a zero ou sair.

## 3. Cronograma revisado

| Dias  | Frente                                                                              |
| ----- | ------------------------------------------------------------------------------------ |
| 1–2   | Produção: Supabase prod, migrations, PITR testado, Sentry, domínio                   |
| 2–3   | Execução do que já existe: RLS/concorrência em Postgres + sandbox MP ponta a ponta   |
| 3–6   | iCal bidirecional (§2.1) — único bloco de construção                                |
| 7–8   | Onboarding do cliente: dados reais, equipe, links iCal, treinamento de 1h, manual    |
| 9–10  | Piloto assistido, correção no dia, medição                                           |

Paralelo, sem bloquear: conformidade (§2.4) e a decisão de `marketplace_fee`.

**Com o checkout já pronto, a pergunta deixa de ser "quando dá para cobrar" e
passa a ser "quando abrimos".** Se §2.2 fechar limpa no dia 3, o checkout pode
entrar no piloto desde o início, de forma controlada: uma acomodação, limite de
valor, acompanhamento transação a transação nos primeiros dias.

## 4. Referências das grandes plataformas — o que copiar e o que não

Referência **funcional** é legítima e encurta meses. O que não se faz:
reproduzir layout, CSS, identidade visual, textos ou marca, nem raspar conteúdo.

| Área da Rota                | Referência                    | O que observar                                                                                |
| --------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Mapa de quartos, operação   | Cloudbeds, Stays.net, HQBeds  | Tape chart, arrastar reserva entre quartos, cores de status, fechamento de diária             |
| Tarifas e restrições        | Little Hotelier, Omnibees     | Tarifa por temporada, mínimo de noites, release, política de cancelamento por tarifa          |
| Ficha e jornada do hóspede  | Cloudbeds, Mews               | Pré-check-in, documentos, histórico, observações que a equipe usa de verdade                  |
| Vitrine e busca             | Booking, Airbnb               | Filtros, hierarquia da página da propriedade, comparação, prova social, clareza do preço final |
| Sincronização de calendário | Airbnb, Booking (iCal)        | Formato do feed, frequência, o que cada uma exporta e o que ignora                            |
| Confiança                   | Airbnb                        | Como comunica cancelamento, reembolso e contato — copiar a *clareza*, não o texto             |

Regra prática: entrar como hóspede e como anfitrião nessas plataformas, anotar o
fluxo em passos, e desenhar o nosso a partir do problema — não da tela delas.

## 5. Ainda aberto, mas fora do caminho crítico

- `images.unoptimized: true` em `next.config.mjs` (LCP no celular).
- Dois lockfiles; escolher gerenciador canônico.
- Ausência de CI com teste/typecheck/lint/build.
- Deduplicação do contexto de tenant por requisição.
- Agentes com LLM. Hoje tudo é determinístico — para o piloto, isso é vantagem.

## 6. Checklist de go-live

- [ ] Migrations aplicadas em produção e schema conferido
- [ ] PITR ativo e restauração testada
- [ ] RLS e concorrência executadas contra Postgres, não simuladas
- [ ] Sandbox do Mercado Pago percorrido ponta a ponta
- [ ] Sentry recebendo erro de teste
- [ ] Domínio, HTTPS e `NEXT_PUBLIC_SITE_URL` corretos
- [ ] Service role key ausente do bundle do client
- [ ] iCal importando e exportando, validado nas duas pontas
- [ ] Disponibilidade fail-closed confirmada por teste
- [ ] Decisão sobre `marketplace_fee` tomada e aplicada
- [ ] Dados reais da pousada carregados e conferidos pelo dono
- [ ] Equipe treinada e manual entregue
- [ ] Termos, privacidade e contrato do piloto assinados
- [ ] Plano de contingência combinado com a pousada
