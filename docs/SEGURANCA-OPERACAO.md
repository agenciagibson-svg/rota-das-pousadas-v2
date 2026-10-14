# Segurança — operação

O que precisa existir FORA do código para a segurança do projeto valer: segredos,
configurações de painel e decisões assumidas. O que o código e o banco já
garantem está nas migrations (`0047`, `0053`, `0054`, `0081`, `0083`) e em
`AUDITORIA-SEGURANCA.md`.

## 1. Segredos

| Variável                                                                                       | Onde vive                     | Se vazar                                                               | Se perder                                                                    |
| ---------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                    | Vercel (Production/Preview)   | Acesso total ao banco. Girar no painel do Supabase na hora.            | Gera outra no painel.                                                        |
| `PAYMENT_TOKENS_ENCRYPTION_KEY`                                                                | Vercel + cofre fora da Vercel | Expõe tokens Mercado Pago das pousadas e CPFs, se o banco vazar junto. | **Sem volta**: todo CPF cifrado e toda conexão Mercado Pago ficam ilegíveis. |
| `MERCADO_PAGO_APP_SECRET`, `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_PLATFORM_ACCESS_TOKEN` | Vercel                        | Girar no painel do Mercado Pago.                                       | Gera outra no painel.                                                        |
| `CRON_SECRET`                                                                                  | Vercel                        | Alguém dispara os crons. Trocar o valor.                               | Gera outro.                                                                  |
| `TURNSTILE_SECRET_KEY`                                                                         | Vercel                        | Girar no Cloudflare.                                                   | Gera outra. Em produção, sem ela o formulário de orçamento recusa os envios. |
| `SMTP_PASS`                                                                                    | Vercel                        | Revogar a senha de app do Gmail.                                       | Gera outra.                                                                  |

### `PAYMENT_TOKENS_ENCRYPTION_KEY` — cópia de segurança obrigatória

É a única chave que não se recupera. Guarde uma cópia em um gerenciador de
senhas (1Password, Bitwarden) com o nome do projeto e a data. Confira a cópia
sempre que mexer nas variáveis da Vercel.

Uma só chave-base protege três coisas, cada uma com subchave derivada própria
(`scrypt` com sal diferente): tokens do Mercado Pago, documentos de hóspedes e
o `state` do OAuth. Separar em duas variáveis não reduziria o risco real — as
duas viveriam no mesmo lugar (Vercel) — então a decisão é manter uma chave com
cópia guardada.

**Rotação** (só se a chave vazar): gerar chave nova, recifrar
`guests.document_number`, `booking_guests.document_number`,
`traveler_profiles.document_number` e os hashes de busca com um script nos
moldes de `scripts/backfill-document-encryption.mjs`, e pedir a cada pousada
que reconecte o Mercado Pago (os tokens antigos não são recuperáveis com a
chave nova).

## 2. Configurações de painel (não ficam no repositório)

Supabase → Authentication:

- **Confirm email** ligado. Sem ele, o cadastro revela se um e-mail já tem conta.
- **Rate limits** de login e de cadastro revisados. A trava de login do app
  (`0083`: 5 falhas por e-mail vindas da mesma rede em 15 min, e 30 falhas de
  uma rede somando contas) vale para quem entra pelo site e existe para
  atrapalhar o curioso sem deixar ninguém travar a conta de outra pessoa. Quem
  chama a API do Supabase Auth direto só é contido por estes limites do painel.
- **NÃO ligar o CAPTCHA do Auth por enquanto.** As telas de login e cadastro
  ainda não enviam o token do CAPTCHA; ligado no painel, todo login e cadastro
  passa a falhar. Só ligar depois que o app enviar `captchaToken`.
- **Leaked password protection** ligado.
- **Site URL / Redirect URLs** apontando para o domínio de produção.

Supabase → Database: backup diário e, antes do primeiro cliente pagante, um
teste de restauração (PITR).

Vercel:

- Plano Pro (uso comercial) e cron de canais a cada 15 minutos.
- `MERCADO_PAGO_TEST_MODE` ausente em Production.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` em Production e em
  Preview. Sem a chave secreta, todo deploy recusa os pedidos de orçamento.
- `SENTRY_DSN` em Production: falhas técnicas do servidor viram alerta.
- Preview usa o mesmo banco de produção: precisa da MESMA
  `PAYMENT_TOKENS_ENCRYPTION_KEY`, senão não lê os documentos cifrados (e o app
  bloqueia a edição de acompanhantes para não apagar o que não conseguiu ler).

## 3. Decisões assumidas

- **Leitura por papel de plataforma.** Qualquer papel da equipe da Rota lê
  catálogo (quartos, disponibilidade, mídia), vínculos de equipe, assinaturas,
  faturas e a fila de pagamentos para revisar. Escrita e dados de hóspede
  exigem concessão ativa e justificada (`platform_access_grants`) ou papel
  específico (comercial/master). Reavaliar quando a equipe passar de poucas
  pessoas de confiança.
- **Contagem de visita da página da bio no GET.** `record_link_event` roda no
  carregamento de `/<slug>` porque a página funciona sem JavaScript. O evento é
  só um contador, com teto por minuto.
- **Upload direto do navegador para o Storage** (fotos da pousada e comprovante
  Pix). Exceção à regra "cliente não fala com o Supabase": o arquivo não passa
  pelo servidor do app. As policies de Storage (`0076`, `0083`) e a RPC
  `submit_payment_proof` validam dono, tipo, tamanho e quantidade.
- **Cadastro de pousada aberto.** Qualquer conta pode enviar um cadastro
  (`create_pousada`), limitado a 2 em análise por conta. A pousada só aparece
  no site depois de aprovada pela equipe.
- **`style-src 'unsafe-inline'`** continua na CSP: `next/font` e o Tailwind
  injetam estilo inline. Scripts seguem só com nonce.

## 4. Antes de publicar uma migration de segurança

1. `pnpm test:db` (aplica todas as migrations num Postgres descartável e roda
   `supabase/tests/priorities.sql` e `security-0083.sql` como `anon`,
   `authenticated` e `service_role`).
2. Conferir o rollback correspondente em `supabase/rollback/`.
3. Perguntar de cada RPC nova: "o que acontece se alguém chamar isto direto na
   API, com a anon key e o próprio login, sem passar pela tela?".
