# Rota das Pousadas — Ciclo 01: diagnóstico para Android e iPhone

**Data:** 07/10/2026 · **Natureza:** diagnóstico e planejamento (nenhum código, dependência, banco ou deploy foi alterado)
**Repositório analisado:** `C:\Projeto Rota das Pousadas\extracted\rota-das-pousadas-main` (branch `main`, HEAD `2ca4872` de 01/10/2026 = `origin/main`)
**Site em produção:** https://rotadaspousadas.com.br/

> Este documento não declara o aplicativo pronto nem aprovado. Ele descreve o que foi inspecionado, o que foi executado e o que ainda depende de implementação, teste e decisão do titular.

---

## 0. O que foi inspecionado e executado

| Tipo | O que foi feito |
|---|---|
| Leitura de código | `AGENTS.md`, `AI_RULES.md`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.mjs`, `vercel.json`, `proxy.ts`, `.env.example` (somente nomes de variáveis), `lib/supabase/*`, `server/queries.ts`, `repositories/*`, `features/{auth,reservas,pagamentos,favoritos,estadia,concierge,admin,gestao}`, `components/landing/*`, `components/pousada/pousada-detail.tsx`, `app/**` (56 `page.tsx` + route handlers), `supabase/seed.sql` e migrations `0001`, `0041`, `0078`, `docs/Architecture.md §10` |
| Git (somente leitura) | `git status`, `git log`, `git diff` |
| Verificação estática local | Réplica em shell da regra de `app/dynamic-pages.test.ts` (página sem sinal de renderização por requisição) aplicada ao commit publicado (HEAD) e à árvore local |
| Inspeção pública (somente leitura) | Leitura de 4 páginas públicas em 07/10/2026: `/`, `/pousadas`, `/pousada/refugio-das-nuvens`, `/privacidade` |
| Fontes oficiais das lojas | Apple App Review Guidelines, Apple Developer (inscrição), Apple Newsroom (Brasil, jun/2026), Google Play Console Help (exclusão de conta, testes, verificação), Android Developers (target SDK), Capacitor (política de suporte) |

**Não executado (e por quê):**

- `pnpm typecheck`, `pnpm test`, `pnpm build`: o `node_modules` foi instalado no Windows (links do pnpm e binários `win32-x64` de esbuild/rollup) e não é utilizável no ambiente Linux de análise; reinstalar dependências estava fora do escopo deste ciclo. **Estado de build/testes não confirmado neste ciclo.**
- Consulta ao banco de produção, painel da Vercel, painel do Supabase, Mercado Pago: não acessados. Afirmações sobre dados de produção vêm da inspeção pública e são marcadas como tal.
- Nenhuma reserva, pagamento, cadastro ou envio a usuário foi feito.

---

## 1. Conclusão objetiva

1. **O sistema atual é um site Next.js 16 server-first e não pode ser empacotado como está.** Todas as 56 páginas são renderizadas por requisição; a escrita passa por 20 arquivos de Server Actions; a sessão é por cookie (`@supabase/ssr`); a CSP depende de nonce por requisição (`proxy.ts`). Exportação estática não é viável sem reescrever a arquitetura — e não deve ser forçada.
2. **Caminho recomendado: Capacitor 8 com um frontend mobile dedicado (empacotado no app) consumindo uma API versionada nova (`/api/mobile/v1`) no mesmo projeto Next, que chama os Services e Repositories existentes.** O backend, as regras de negócio, as RPCs, o RLS, os webhooks e os crons são reaproveitados integralmente. A interface do app é nova, mas reaproveita schemas Zod, tipos, lógica pura e design tokens.
3. **Escopo do primeiro app: jornada do hóspede** (busca, detalhe, disponibilidade, reserva, pagamento, minhas reservas, favoritos, conta e app da estadia). O painel da pousada continua na web nesta fase, entre outros motivos porque contém a contratação da assinatura digital, que no iOS entra nas regras de compra dentro do app.
4. **Há bloqueios antes de qualquer publicação**, independentes do app:
   - dados demonstrativos publicados em produção como se fossem reais (4 pousadas de seed com notas e contagens fictícias, reserváveis; números e depoimentos fixos na home) e um registro de teste ("Rota Teste") visível no catálogo;
   - ausência de exclusão de conta dentro do produto (exigida pelas duas lojas);
   - um lote local de correções de 04/10 (124 entradas, incluindo a migration `0083` e a correção das páginas estáticas) ainda não publicado.
5. **Nada disso garante aprovação.** Recursos nativos (notificações, câmera, links) agregam valor ao app, mas a análise de cada loja é caso a caso.

---

## 2. Tecnologias e versões confirmadas

| Item | Versão / valor | Evidência |
|---|---|---|
| Framework | Next.js **16.3.8** (App Router, `proxy.ts` no lugar de `middleware.ts`) | `package.json`, `pnpm-lock.yaml`, `proxy.ts` |
| UI | React **19.2.4**, Tailwind CSS **4.3.3**, shadcn/Base UI, lucide-react, motion | `pnpm-lock.yaml` |
| Linguagem | TypeScript **5.7.3** (strict) | `package.json`, `tsconfig.json` |
| Dados/Auth | Supabase — `@supabase/supabase-js` **2.110.9**, `@supabase/ssr` **0.5.2** | `pnpm-lock.yaml`, `lib/supabase/*` |
| Validação/forms | Zod **3.25.76**, React Hook Form | `pnpm-lock.yaml` |
| Testes | Vitest **2.1.9**, Testing Library, jsdom | `pnpm-lock.yaml`, `vitest.config.ts` |
| Hospedagem | Vercel (projeto `rota-das-pousadas-main`), 2 crons diários (`/api/cron/canais`, `/api/cron/expiracao`), Vercel Analytics | `.vercel/project.json` (IDs omitidos), `vercel.json`, `app/layout.tsx` |
| Pagamentos | Pix direto na conta da pousada (QR + comprovante) e Mercado Pago Checkout Pro (OAuth por pousada); assinatura da Rota via Mercado Pago Preapproval | `features/pagamentos/*`, `.env.example` |
| E-mail | SMTP (nodemailer) | `.env.example`, `lib/email/*` |
| Banco | 83 migrations (`0001` → `0083`); `0083` só existe localmente | `supabase/migrations/` |
| PWA | Manifesto do site (`app/manifest.ts`) e do app da estadia (`app/estadia/manifest.webmanifest/route.ts`); **sem service worker** | busca por `serviceWorker` sem resultado |

**Estado do repositório local:** HEAD = `origin/main` (`2ca4872`, 01/10), mas com **124 entradas não commitadas** (103 arquivos modificados + novos testes, `docs/SEGURANCA-OPERACAO.md` e `0083_seguranca_hardening_4.sql`). É o lote descrito em `Claude outputs/PUBLICAR-SEGURANCA-QUALIDADE-2026-10-04.md`. O que está em produção corresponde, presumivelmente, ao HEAD — a Vercel não foi consultada.

---

## 3. Mapa do que existe

Legenda: **Real** = implementado ponta a ponta no código · **Interface** = tela sem lógica de dados · **Demo** = dados ou números fictícios · **Não verificado** = existe no código, mas não foi exercitado neste ciclo.

### 3.1 Jornada do hóspede

| Função | Situação | Evidência |
|---|---|---|
| Busca de pousadas | **Real** (texto, datas, hóspedes, paginação) | `app/pousadas/page.tsx` → `server/queries.ts:71` → `repositories/pousadas.repository.ts` → RPC `search_public_pousadas` (`0041`, filtro em `0041:67`) |
| Busca da home (hero) | **Real** (redireciona para a busca) | `components/landing/hero.tsx:100` |
| Destinos da home | **Demo + defeito**: dados de seed (contagens, notas e “a partir de” fictícios) e link fixo | `components/landing/destinations.tsx:39`, `supabase/seed.sql:7-15` |
| Ofertas sazonais | Conteúdo editorial fixo que gera uma busca real | `components/landing/seasonal-offers.tsx:195` |
| Prova social | **Demo**: “3.400+ pousadas”, “180 destinos”, “4.9”, “96%” e depoimentos fixos | `components/landing/social-proof.tsx:7-30` |
| Concierge | **Real, determinístico** (regras, sem IA) sobre o catálogo | `features/concierge/recommendations.ts`, `AGENTS.md` |
| Detalhe da pousada | **Real**; nota/contagem de avaliações inconsistentes (ver §4) | `app/pousada/[slug]/page.tsx`, `components/pousada/pousada-detail.tsx` |
| Disponibilidade e quartos | **Real** | RPC `list_bookable_rooms` (`0041`), `repositories/availability.repository.ts` |
| Login / cadastro / nova senha | **Real**: e-mail + senha no Supabase, sessão por cookie; recuperação com token próprio enviado por e-mail | `features/auth/actions.ts:75,139`, `features/auth/services/password-reset.service.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts` |
| Login social | **Não existe** (somente e-mail/senha) | sem `signInWithOAuth` no código |
| Favoritos | **Real** | `features/favoritos/actions.ts:19`, `app/favoritos/page.tsx` |
| Reserva | **Real** | `features/reservas/actions.ts:30`, `app/pousada/[slug]/reservar/page.tsx` |
| Minhas reservas | **Real** | `app/minhas-reservas/page.tsx`, `server/queries.ts:93-101` |
| Pagamento Pix direto | **Real; não verificado com dinheiro** — QR/copia e cola, upload do comprovante direto ao Storage (`payment-proofs`) e revisão pelo operador | `features/pagamentos/components/pix-payment-panel.tsx:87-112`, `migrations/0082` |
| Pagamento Mercado Pago | **Real; não verificado em produção** — link gerado no clique, `back_urls` para o site, webhook com reconciliação idempotente | `app/pousada/[slug]/reservar/[id]/pagar/route.ts`, `features/pagamentos/services/checkout.service.ts:52`, `mp-client.ts:155-160`, `migrations/0042` |
| Perfil | **Real** | `app/conta/page.tsx` |
| **Exclusão de conta** | **Não existe no produto** — os Termos pedem solicitação por e-mail | `app/termos/page.tsx:219`, `app/privacidade/page.tsx:172`; busca por exclusão de conta sem resultado |
| App da estadia | **Real; teste ponta a ponta do hóspede não verificado** — pedidos, conta, recepção, avaliação; PWA instalável; atualização por polling de 60 s | `app/estadia/*`, `features/estadia/actions.ts`, `features/estadia/components/guest-stay-app.tsx:104-111`, `install-prompt.tsx` |

### 3.2 Gestão da pousada e da plataforma (fica na web nesta fase)

| Área | Situação | Evidência |
|---|---|---|
| Painel da pousada (23 páginas): reservas, acomodações, bloqueios, canais iCal, financeiro, estoque, pedidos/QR, hóspedes, FNRH, membros, marketing, link da bio, configurações | **Real** | `app/dashboard/**`, `features/*` |
| Assinatura da pousada (R$ 59,90/mês) | **Real** — botão “Assinar agora” leva ao checkout de assinatura do Mercado Pago | `features/gestao/components/owner-settings-view.tsx:167`, `features/pagamentos/services/subscription.service.ts:103-119`, `.env.example` |
| Painel master (12 páginas) | **Real** | `app/admin/**` |

---

## 4. Achados da inspeção pública de 07/10/2026

| # | Indício | Confirmado? | Causa verificável | Prioridade |
|---|---|---|---|---|
| A | “Rota Teste” no catálogo público com descrição de teste | **Sim** — aparece em `/pousadas` (Uberlândia/MG, 0,0, descrição ilegível) | O registro está no banco (não no código) com `status = 'publicada'`. O catálogo mostra toda pousada publicada com `tenant_status` em `onboarding`/`active` (`0041:67`). O painel master permite publicar na criação (`features/admin/services/admin.service.ts:147`). Não existe marcação de teste/demonstração no esquema. | **P0** |
| B | Destinos da home apontam para Refúgio das Nuvens | **Sim** — os 8 destinos usam o mesmo link | Link fixo no código: `href={`/pousada/refugio-das-nuvens`}` em `components/landing/destinations.tsx:39`. | **P1** |
| C | Refúgio das Nuvens com 328 avaliações, mas sem avaliações públicas | **Sim** | `pousadas.rating`/`reviews` são colunas (`0001_init.sql:101-102`) preenchidas pelo seed com 4.9/328 (`seed.sql:35-38`). O gatilho de `0078` só recalcula quando entra uma avaliação, e o acerto retroativo só alcançou pousadas que já tinham avaliação (`0078_estoque_pedidos.sql:819-824`). O cabeçalho mostra a coluna (`pousada-detail.tsx:238-240`); a seção lista as avaliações públicas e mostra o estado vazio (`pousada-detail.tsx:444`). O gatilho também conta avaliações não públicas. | **P0** (dado fictício exibido como real) |
| D | Política de privacidade “carregando” | **Causa provável confirmada no código** | No commit publicado, `/privacidade` (e `/termos`, `/` e `/dashboard/pedidos/qrcode`) não tinha sinal de renderização por requisição → pré-renderizada no build, sem nonce → a CSP estrita de `proxy.ts` bloqueia os scripts do Next. O HTML público traz o texto completo **e** o fallback “Preparando sua rota…” de `app/loading.tsx:6` duas vezes, o que é consistente com a troca do fallback não executar. A correção (`export const dynamic = 'force-dynamic'`) **já existe localmente, mas não foi publicada** (`git diff app/privacidade/page.tsx`). A verificação estática local mostra 4 páginas estáticas no HEAD e 0 na árvore local. Confirmar no navegador após publicar. | **P0** (página exigida pelas lojas) |

**Achados adicionais ligados a estes:**

- As 4 pousadas do seed (Refúgio das Nuvens, Vale Esmeralda, Cabana do Cerrado, Casa do Mar Noronha) estão publicadas em produção com os valores exatos do `seed.sql` (4.9/328, 4.8/214, 5.0/156, 5.0/402) e **Refúgio das Nuvens mostra “Reservar agora” com uma acomodação a R$ 720/noite** — um visitante real pode tentar reservar uma pousada fictícia. **P0.**
- Os destinos também vêm do seed com contagens fictícias (ex.: Gramado 212 pousadas). **P1.**

**Correções propostas (não executadas; exigem aprovação, sem excluir registros):**

1. Ocultar do catálogo, pelo painel master, “Rota Teste” e as 4 pousadas de seed (botão “Suspender” já existe — `features/admin/components/pousadas-table.tsx:24`). É uma alteração em produção: decisão do titular.
2. Adicionar uma marcação de visibilidade (ex.: `is_demo`/`visibility`) excluída do catálogo e da sitemap, para testes e para a pousada da revisão das lojas.
3. Destinos: link para `/pousadas?busca=<destino>` (a busca já cobre cidade/estado) e contagens calculadas, não fixas.
4. Nota/contagem: calcular a partir das avaliações públicas (ou zerar as colunas das pousadas sem avaliação e contar só as públicas).
5. Prova social: remover números e depoimentos fictícios ou substituí-los por dados reais.
6. Publicar o lote de 04/10 (inclui a correção das páginas estáticas), seguindo a ordem do guia já existente.

---

## 5. Evidências, lacunas e prioridades

P0 = bloqueia publicação ou expõe usuário real a erro · P1 = necessário antes de enviar às lojas · P2 = melhoria.

| # | Tema | Evidência | Lacuna | Prioridade |
|---|---|---|---|---|
| 1 | Dados demonstrativos em produção | §4 A–C; `seed.sql`; `social-proof.tsx` | Catálogo, notas e números fictícios apresentados como reais | P0 |
| 2 | Lote local não publicado | `git status` (124 entradas), guia de 04/10 | Produção sem as correções de segurança e das páginas estáticas | P0 |
| 3 | Exclusão de conta | `termos/page.tsx:219` | Sem fluxo no produto; Apple 5.1.1(v) e Google Play exigem caminho no app e (Google) link web | P0 |
| 4 | API para cliente externo | 20 arquivos `'use server'`; 33 de 33 repositories usam `createSupabaseServerClient()` (cookies) | Não há API versionada nem autenticação por token | P0 (para o app) |
| 5 | Retorno de pagamento | `checkout.service.ts:52` (`back_urls` web) | Retorno precisa voltar ao app (link universal / App Link) | P1 |
| 6 | Upload de comprovante | `pix-payment-panel.tsx:100-112` (upload direto do navegador ao Storage) | No app, usar URL de upload assinada emitida pela API | P1 |
| 7 | Links de e-mail | `password-reset.service.ts` (link para `/redefinir-senha`); `signUp` sem `emailRedirectTo` (`features/auth/actions.ts:141`) | Abrir no app via links universais; confirmar redirecionamento da confirmação de e-mail | P1 |
| 8 | Links externos | `target="_blank"` para mapas/Waze/WhatsApp/Instagram em `features/estadia/components/stay-details.tsx` e `stay-home.tsx` | No app, abrir com o navegador do sistema | P1 |
| 9 | Falta de conexão | Sem service worker; `Architecture.md §10` prevê offline como fase futura | Definir cache de leitura e bloqueio claro de escrita | P1 |
| 10 | Conta e pousada para revisão | — | Revisores precisam de conta demo e de uma pousada reservável não pública | P1 |
| 11 | Validação com dinheiro real | `prontidao-2026-10-04` (validação ~25%) | Pix e Mercado Pago não validados ponta a ponta em produção | P1 |
| 12 | Assinatura digital no iOS | `owner-settings-view.tsx:167` | Fica fora do app iOS nesta fase ou exige decisão (§8) | P1 (se a gestão entrar no app) |
| 13 | Build/testes não confirmados neste ciclo | §0 | Rodar `typecheck`/`test`/`build` no Windows antes do Ciclo 02 | P1 |
| 14 | Contraste, alvos de toque, busca/sino falsos no cabeçalho | `prontidao-2026-10-04` | Itens de design pendentes | P2 |
| 15 | Notificações push | `Architecture.md §10` (planejado) | Não existe; opcional | P2 |

---

## 6. Arquitetura mobile recomendada

### 6.1 O que pode ir no app e o que depende do servidor

| Parte | Onde fica | Motivo (evidência) |
|---|---|---|
| Telas, navegação, estados de carregamento | **App** | Novo frontend empacotado |
| Validação de formulário | **App + servidor** | Schemas Zod de `features/*/schemas.ts` reaproveitáveis; o servidor revalida |
| Formatação, datas, rótulos de status, exibição de preço | **App** (somente exibição) | `lib/format.ts`, `lib/dates.ts`, `features/reservas/status.ts`, `features/reservas/pricing.ts` — o servidor continua sendo a fonte do valor |
| Design tokens | **App** | `styles/tokens.css`, `styles/typography.css`, `lib/design-tokens.ts`, Tailwind 4 |
| Qualquer acesso ao Supabase | **Servidor** | RLS por JWT; regra “nunca Client → Supabase” (`docs/Architecture.md`) |
| Mercado Pago, Pix, chaves cifradas | **Servidor** | `PAYMENT_TOKENS_ENCRYPTION_KEY`, webhooks e reconciliação (`0042`) |
| Trava de login, recuperação de senha | **Servidor** | usam service role (guia de 04/10) |
| Crons, iCal, FNRH, e-mail | **Servidor** | `vercel.json`, `features/canais`, `lib/email` |

**Por que não reaproveitar o site diretamente:**

- *Server Actions* não são uma API pública: os identificadores são gerados no build e mudam a cada deploy. Um app instalado ficaria quebrado após qualquer publicação do site.
- *Cookies*: um app empacotado roda em outra origem (`capacitor://localhost` no iOS, `https://localhost` no Android). Cookies do domínio do site seriam de terceiros dentro do WebView — comportamento instável, sobretudo no iOS.
- *Rotas dinâmicas e CSP com nonce*: as 56 páginas dependem do servidor; não há exportação estática possível sem desfazer a arquitetura.
- `server.url` apontando para o site público está descartado como solução de produção (requisito deste ciclo), e um site reembalado é exatamente o que a diretriz 4.2 da Apple descreve como insuficiente.

### 6.2 Opções avaliadas

| Opção | Reaproveitamento | Riscos | Veredito |
|---|---|---|---|
| Capacitor carregando o site (`server.url`) ou TWA | Máximo, sem trabalho | Descartada por requisito; risco 4.2; app depende do site estar no ar; cookies | **Não** |
| Exportação estática do Next dentro do Capacitor | — | Inviável sem reescrever server-first (Server Actions, proxy, RSC) | **Não** |
| **Capacitor + frontend mobile dedicado + API `/api/mobile/v1`** | Backend inteiro (services, repositories, RPCs, RLS, webhooks, crons); schemas Zod, tipos, lógica pura, tokens, ícones; React e Tailwind iguais aos do site | Nova camada de API e autenticação por token a construir e testar; telas novas | **Recomendada** |
| React Native / Expo + mesma API | Mesmo backend e schemas; UI não reaproveita React DOM nem Tailwind direto | Duas bases de UI com tecnologias diferentes; ganho real só se houver necessidade de desempenho nativo pesado, mapas complexos ou muito trabalho offline — não há evidência disso hoje | Não agora; reavaliar se surgir necessidade concreta |

A API `/api/mobile/v1` é útil para qualquer cliente: se um dia a escolha mudar para React Native, ela continua valendo.

### 6.3 Desenho da recomendação

```
App (Capacitor 8: iOS 15+, Android 7+/API 24+, targetSdk 36)
  Vite + React 19 + TS + Tailwind 4 + roteador + cache de consultas
  Plugins: App (deep links, botão voltar), Browser (checkout e links externos),
           armazenamento seguro (Keychain/Keystore), Network, Camera, Share,
           Splash/Status bar; Push opcional
        │  HTTPS + Authorization: Bearer <access_token>
        ▼
Next.js na Vercel (o mesmo projeto, sem mudar o site)
  app/api/mobile/v1/*  (Route Handlers: Zod → Service → Repository)
  .well-known/apple-app-site-association e assetlinks.json
        ▼
Services e Repositories existentes → Supabase (RLS pelo JWT do usuário)
```

**Ponto de integração principal:** `lib/supabase/server.ts`. Hoje `createSupabaseServerClient()` lê cookies. A proposta é criar um cliente por requisição que, nas rotas `/api/mobile/v1`, use o `Authorization: Bearer` (o Postgres aplica o RLS com o JWT do usuário, como já faz com o cookie). Assim os 33 repositories não mudam. Pontos que precisam de ajuste e teste: `features/auth/services/auth.service.ts` (uso de `connection()` e leitura do usuário a partir do token), `features/bio/services/bio.service.ts` e `features/canais/services/channels.service.ts` (`revalidatePath` — fora do escopo do app do hóspede).

**Conformidade com a arquitetura vinculante:** o fluxo passa a ser *App → Route Handler → Zod → Service → Repository → Supabase*, sem cliente acessando o banco. Ainda assim é uma camada nova não prevista em `docs/Architecture.md`; recomenda-se registrar um ADR antes de implementar.

**Organização sugerida:** pasta `mobile/` no mesmo repositório, com `package.json` próprio, excluída do `tsconfig.json` e do ESLint da raiz (hoje o `include` é `**/*.ts`) para não afetar o build da Vercel. Uma regra de lint deve impedir o app de importar módulos `server-only`.

### 6.4 Adaptações necessárias

| Tema | Hoje (site) | No app |
|---|---|---|
| **Login** | Server Action com `signInWithPassword` e cookie | `POST /api/mobile/v1/auth/login` (mesma trava de tentativas) devolve tokens; armazenamento seguro; renovação por `/auth/refresh`; logout revoga |
| **Cadastro / confirmação / nova senha** | Links de e-mail para o site | Mesmos e-mails, com links universais para `/redefinir-senha` e para a confirmação; o token de nova senha só é consumido no envio (`password-reset.service.ts`), o que funciona igual no app |
| **Retorno do Mercado Pago** | `back_urls` para a página de pagamento | Checkout aberto no navegador do sistema (SFSafariViewController / Custom Tabs); `back_urls` em caminho próprio com link universal; o app consulta o status pela API — o webhook continua sendo a fonte da verdade |
| **Pix direto** | QR e upload direto ao Storage | QR e copia e cola nativos; upload com URL assinada emitida pela API, depois `submitPaymentProof` pela API; câmera ou arquivo |
| **Links** | URLs do site; QR do quarto aponta para `/estadia` | Links universais (iOS) e App Links (Android) para `/pousada/*`, `/estadia*`, `/minhas-reservas`, `/redefinir-senha`, retorno de pagamento; sem o app instalado, o site continua atendendo |
| **Navegação** | Navegador | Pilha de telas; botão voltar do Android; links externos (mapas, Waze, WhatsApp) no navegador do sistema |
| **Sem conexão** | Sem service worker | Telas do app já empacotadas; cache de leitura com data da última atualização (reservas, detalhes da estadia); reserva, pagamento e pedido **nunca** ficam em fila offline — o app bloqueia e explica |
| **CORS e segurança** | CSP com nonce em páginas | API JSON sem cookie (sem CSRF), CORS restrito às origens do app, limite de requisições por usuário/IP |

### 6.5 Principais arquivos e módulos envolvidos

- Reaproveitados sem mudança: `repositories/*`, `features/{reservas,pagamentos,favoritos,estadia,pousadas,concierge}/services/*`, `features/*/schemas.ts`, `types/*`, `lib/format.ts`, `lib/dates.ts`, `lib/pix/*`, `supabase/migrations/*`, webhooks e crons.
- Ajustados: `lib/supabase/server.ts` (cliente por Bearer), `features/auth/services/auth.service.ts`, `features/pagamentos/services/checkout.service.ts` (`back_urls` por canal), `proxy.ts` (manter a API fora do redirecionamento de login e servir `.well-known`).
- Novos: `app/api/mobile/v1/**`, `app/.well-known/**`, fluxo de exclusão de conta (web e app), `mobile/**`, ADR em `docs/`.

---

## 7. Plano por etapas

### Etapa 0 — Correções essenciais (antes de qualquer trabalho mobile)

1. Rodar `pnpm.cmd typecheck`, `pnpm.cmd test` e `pnpm.cmd build` no Windows e publicar o lote de 04/10 seguindo o guia existente (código primeiro, migration `0083` depois).
2. Confirmar no navegador que `/privacidade`, `/termos` e a home carregam sem erro de CSP no console.
3. Ocultar (sem excluir) “Rota Teste” e as pousadas de seed; corrigir o link dos destinos; corrigir nota/contagem de avaliações; retirar números e depoimentos fictícios.
4. Criar a exclusão de conta no site (perfil → excluir conta, com confirmação, explicação do que é retido por obrigação legal — reservas, pagamentos, FNRH — e anonimização do restante) e a página pública de solicitação.
5. Marcação de visibilidade para pousadas de teste/revisão.

### Etapa 1 — Base de backend para o app

1. ADR da API mobile e da autenticação por token.
2. `lib/supabase/server.ts` com cliente por Bearer; testes de isolamento RLS com dois usuários.
3. `/api/mobile/v1`: auth (login, cadastro, refresh, logout, nova senha), catálogo, detalhe, disponibilidade, reservas, pagamentos (Pix e link do Mercado Pago), favoritos, perfil, exclusão de conta, estadia (pedidos, conta, avaliação).
4. Arquivos `.well-known` e caminhos de retorno de pagamento.

### Etapa 2 — App do hóspede

1. Projeto `mobile/` (Vite + React + Tailwind 4 + Capacitor 8), tokens do site.
2. Telas na ordem da jornada: busca → detalhe → reserva → pagamento → minhas reservas → estadia → favoritos → conta/exclusão.
3. Deep links, botão voltar, links externos, armazenamento seguro, estado sem conexão, ícones e splash.

### Etapa 3 — Testes

1. Unitários e de contrato da API (Vitest), incluindo token expirado, token de outro usuário e limites.
2. Android: emulador e aparelho físico; iOS: simulador e aparelho via TestFlight.
3. Ponta a ponta com a pousada de revisão: reserva, Pix com comprovante, Mercado Pago em sandbox, retorno ao app, pedido na estadia, exclusão de conta.
4. Links universais/App Links a partir de e-mail e do QR do quarto; modo avião; acessibilidade (tamanho de fonte, leitor de tela).

### Etapa 4 — Publicação

1. Google Play: teste interno → teste fechado (12 testadores por 14 dias, se a conta for pessoal) → produção.
2. App Store: TestFlight interno → externo (passa por revisão beta) → envio com notas de revisão e conta demo.
3. Fichas, imagens, privacidade e declarações de dados (§9).

---

## 8. Cobrança: hospedagem × assinatura do sistema

| Cobrança | Natureza | Regra aplicável | Consequência |
|---|---|---|---|
| Reserva de hospedagem (Pix, Mercado Pago) | Serviço consumido fora do app | Apple 3.1.3(e): **deve** usar meio de pagamento próprio, não compra dentro do app | Pix e Mercado Pago seguem como estão |
| Pedidos da estadia (água, toalha etc.) | Bens/serviços físicos | Mesmo enquadramento | Seguem como estão |
| Assinatura da pousada (R$ 59,90/mês) | Funcionalidade digital do sistema de gestão | Apple 3.1.1 (compra dentro do app para desbloquear funcionalidade/assinatura); 3.1.3(c) cobre apenas vendas diretas a organizações para uso de seus funcionários — enquadramento caso a caso; no Brasil, desde 18/06/2026, apps da App Store podem oferecer processamento alternativo ou link para site, sempre ao lado da compra da Apple, com comissões próprias | **Fase 1: a contratação da assinatura fica fora do app** (o app é do hóspede). Se a gestão entrar no app, decidir entre compra da Apple, pagamento alternativo/link (Brasil) ou contratação exclusivamente fora do app, com análise de custo |

No Google Play, regras equivalentes de faturamento para bens digitais também se aplicam à assinatura; a hospedagem fica fora delas. Confirmar a política vigente de pagamentos do Google Play antes de incluir a gestão.

---

## 9. Requisitos para publicação

### 9.1 Google Play

| Requisito | Situação |
|---|---|
| Conta de desenvolvedor (pessoal ou organização). Organização exige D-U-N-S, documento oficial e documento da organização | Pendente — decisão de titularidade |
| Conta pessoal criada após 13/11/2023: teste fechado com 12+ testadores por 14 dias seguidos antes da produção | Depende do tipo de conta |
| `applicationId` (permanente após publicar) — ex.: `br.com.rotadaspousadas.app` | Pendente |
| Android App Bundle assinado; chave de upload guardada fora do repositório; Play App Signing | Pendente |
| Target API: desde 31/08/2026, novos apps e atualizações devem mirar **Android 16 (API 36)** | Capacitor 8 atende; configurar |
| Ambiente: Android Studio + JDK no Windows (a máquina já tem `.android` e `.gradle`) | Verificar versões |
| Ficha: nome, descrição curta e completa, ícone 512×512, imagem de destaque 1024×500, capturas de tela do celular | Pendente |
| Política de privacidade com URL pública funcionando | Existe; depende da correção do item D |
| Formulário de segurança dos dados (Data safety), incluindo perguntas de exclusão de dados | Pendente — inventário em §9.3 |
| Exclusão de conta: caminho dentro do app **e** link web para solicitar sem reinstalar | **Não existe** |
| Classificação indicativa (questionário), público-alvo, acesso para revisão (conta demo) | Pendente |

### 9.2 App Store

| Requisito | Situação |
|---|---|
| Apple Developer Program (US$ 99/ano). Organização: pessoa jurídica (sem nome fantasia), D-U-N-S, autoridade legal, **e-mail no domínio da organização** e site público ativo. Pessoa física: nome civil aparece como vendedor | Pendente — hoje o contato é um Gmail e o CNPJ/razão social ainda não constam nos Termos |
| Bundle ID, certificados de distribuição e perfis | Pendente |
| Build com **Xcode 26 ou posterior** (exigido desde 28/04/2026) → **precisa de macOS** (Mac próprio ou CI na nuvem) | Pendente — a máquina atual é Windows |
| Diretriz 4.2: o app precisa ir além de um site reembalado | Atendido pelo desenho (frontend dedicado), sem garantia de aprovação |
| Diretriz 5.1.1(v): se há criação de conta, exclusão de conta **dentro do app** | **Não existe** |
| Diretriz 4.8 (login equivalente ao social) | Não se aplica hoje: só e-mail/senha próprio |
| Diretriz 2.1(a): sem conteúdo temporário/placeholder; conta demo e backend ligados | Bloqueado pelos dados demonstrativos (§4) |
| App Privacy (rótulos de privacidade), URL de privacidade, URL de suporte | Pendente |
| Ficha: nome, subtítulo, descrição, palavras-chave, capturas de tela do iPhone (e iPad, se o app rodar em iPad), classificação etária | Pendente |
| Notas de revisão com conta demo e pousada reservável de revisão | Pendente |

### 9.3 Inventário inicial de dados (para Data safety e App Privacy)

Levantado do código; confirmar antes de preencher: nome, e-mail, telefone, dados do perfil de viajante e da FNRH (inclui documento — `features/auth/profile.ts` mascara na tela), reservas e histórico de compras, comprovantes de pagamento (imagem/PDF), avaliações e mensagens, pedidos da estadia, identificador do usuário. Pagamento por cartão é processado pelo Mercado Pago (não passa pelo app). Diagnóstico de erros: Sentry, se ativado. O Vercel Analytics do site não precisa ir para o app.

---

## 10. Decisões pendentes do titular

1. **Titularidade das contas das lojas:** pessoa física ou jurídica; qual empresa (CNPJ/razão social ainda pendentes); D-U-N-S; e-mail corporativo no domínio `rotadaspousadas.com.br`; confirmar a titularidade do domínio e do repositório GitHub.
2. **Identificador e nome do app** nas lojas (permanentes no Android).
3. **Escopo do primeiro app:** só hóspede (recomendado) ou incluir gestão.
4. **Assinatura das pousadas no iOS**, se a gestão entrar no app (§8).
5. **Dados demonstrativos em produção:** aprovar a ocultação (sem exclusão) das pousadas de seed e da “Rota Teste”, e a retirada dos números/depoimentos fictícios.
6. **Publicação do lote de 04/10** antes de começar o Ciclo 02.
7. **Ambiente iOS:** Mac próprio ou serviço de build na nuvem (custo).
8. **Conta e pousada de revisão:** pousada real piloto ou pousada de revisão oculta do catálogo.
9. **Política de exclusão de conta:** prazo de atendimento e o que é anonimizado × retido por obrigação legal (reservas, pagamentos, FNRH).
10. **Notificações push** (opcional): exige Firebase/APNs e consentimento.
11. **Validação com dinheiro real** de Pix e Mercado Pago antes de abrir o app ao público.

---

## 11. Fontes oficiais consultadas (07/10/2026)

- Apple — App Review Guidelines (2.1, 3.1.1, 3.1.3(c), 3.1.3(e), 4.2, 4.8, 5.1.1(v)): https://developer.apple.com/app-store/review/guidelines/
- Apple — Inscrição no Apple Developer Program: https://developer.apple.com/br/help/account/membership/program-enrollment/
- Apple — Mudanças no iOS no Brasil (18/06/2026): https://www.apple.com/newsroom/2026/06/apple-announces-changes-to-ios-in-brazil/
- Requisito de Xcode 26 desde 28/04/2026 (resumo publicado pela Expo): https://expo.dev/blog/app-store-connect-minimum-sdk-26
- Google Play — Exclusão de conta: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play — Requisitos de teste para contas pessoais novas: https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play — Verificação de desenvolvedor (D-U-N-S): https://support.google.com/googleplay/android-developer/answer/10841920
- Android — Target API: https://developer.android.com/google/play/requirements/target-sdk
- Capacitor — Política de suporte (v8): https://capacitorjs.com/docs/next/main/reference/support-policy

Requisitos de loja mudam com frequência: reconfirmar nos consoles no momento do envio.
