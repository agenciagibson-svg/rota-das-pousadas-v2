# Contrato da pousada com aceite eletrônico (0103)

A pousada lê e aceita o contrato com a Rota dentro do painel. O sistema guarda a
cópia exata do texto aceito e a pousada só é publicada pela primeira vez depois
do aceite. As 30 primeiras pousadas publicadas ganham a condição de lançamento.

> **Sobre o modelo de negócio.** `docs/04_BUSINESS_ARCHITECTURE.md §9` (v1.2,
> 19/11/2026) define comissão de 6% por reserva originada, sem mensalidade e
> sem custódia. Esta entrega **não cobra nada**: só registra o aceite e as datas
> da condição de lançamento. A cobrança (`marketplace_fee` no cartão, fatura do
> Pix direto) é uma entrega seguinte e depende do contrato revisado e do parecer
> do contador.

## O interruptor é a versão publicada

Enquanto não existir versão **publicada** em `contract_versions`, nada muda:
ninguém vê contrato, a publicação não é barrada e nenhuma pousada vira
fundadora. O texto definitivo entra pelo /admin → Configurações → Contrato das
pousadas, sem mudança de código:

1. O master cola o texto como **rascunho** (código da versão, título e texto).
2. A tela aponta campo desconhecido e trecho `[entre colchetes]` por definir.
   O banco recusa publicar com qualquer um dos dois.
3. **Publicar** torna a versão a vigente. Versão publicada não muda mais:
   correção de texto é versão nova.

### Campos do modelo

| Campo                     | Vem de                                             |
| ------------------------- | -------------------------------------------------- |
| `{{razao_social}}`        | `pousadas.legal_name`                              |
| `{{documento}}`           | `pousadas.tax_id`                                  |
| `{{nome_fantasia}}`       | `pousadas.name`                                    |
| `{{endereco}}`            | endereço, cidade/UF e CEP                          |
| `{{representante_nome}}`  | nome do proprietário logado (`profiles.full_name`) |
| `{{representante_email}}` | e-mail da conta dele                               |

Linha começando com `#` vira título; parágrafos são separados por linha em
branco.

## O aceite

- Só o **proprietário ativo** aceita (`contract:accept` no app,
  `auth_is_active_owner_of` no banco). Gestor vê a situação; os demais papéis
  não abrem a página.
- O texto é montado **no banco** (`render_pousada_contract`). A tela manda só a
  versão e o hash SHA-256 do que mostrou; se os dados da pousada mudaram no
  meio, o banco recusa e pede para recarregar. Nenhum texto vem do cliente.
- Com dado faltando (razão social, documento, endereço, cidade/UF, nome de quem
  aceita) o aceite fica desligado e a tela lista o que falta.
- `pousada_contract_acceptances` guarda texto, hash, quem, quando, IP e
  navegador. Não tem UPDATE nem DELETE (gatilho), nem para o `service_role`. A
  exclusão da conta de quem aceitou só zera `accepted_by`; nome e e-mail ficam.
- IP e navegador são registro, não regra: quem chama a RPC direto pode mandar
  outro valor. O que decide o aceite é papel, versão e hash.
- Depois do aceite: e-mail com o texto completo para o proprietário e para a
  Rota. A cópia da Rota vai para `CONTRACTS_NOTIFY_EMAIL`; sem a variável, para
  o e-mail de contato de `lib/legal.ts`. Falha de e-mail não desfaz o aceite.
- A cópia aceita fica em Configurações → Contrato, com botão Imprimir (o
  navegador salva em PDF). Não há PDF gerado no servidor nesta entrega.

## Publicação

Gatilho `trg_pousada_first_publication` em `pousadas`:

- Primeira mudança para `publicada` com contrato vigente exige o aceite da
  versão vigente. A mensagem aparece para a equipe no /admin.
- Pousada que já foi publicada (`first_published_at` preenchido) não é barrada:
  suspender e reativar continua funcionando.
- Pousada inserida já publicada (carga da equipe) só recebe a data.

Versão nova com "pedir novo aceite": o painel mostra o aviso e o passo da
configuração guiada volta a ficar pendente. Não há bloqueio automático de quem
já está no ar.

## Fundadoras (condição de lançamento)

Na primeira publicação, com ou sem contrato vigente (0114; a 0103 exigia
contrato), as 30 primeiras recebem:

- `founder_rank` (1 a 30), decidido com trava para não passar de 30 em
  publicações simultâneas;
- `commission_exempt_until` = publicação + 60 dias;
- `commission_rate_locked_until` = publicação + 60 dias + 12 meses (0114).

Comissão das fundadoras (0114): isenta nos 60 dias (regra da 0104); **3%**
(`founder_commission_rate()`) para reserva criada até
`commission_rate_locked_until`; depois, 6%. O extrato mostra o percentual de
hoje (`pousada_commission_rate_now`).

As colunas não têm SELECT pela API e o dono não consegue alterá-las (guarda
0065). O painel mostra as datas pelo `get_pousada_contract_state`. A regra das
reservas isentas (criadas no período, com check-in até 90 dias depois do fim)
é do contrato e será aplicada na entrega que calcular a comissão.

## Onde está

- Banco: `supabase/migrations/0103_contrato_aceite_e_fundadoras.sql`, rollback
  em `supabase/rollback/0103_rollback.sql`, teste em
  `supabase/tests/contrato-0103.sql` (+ corrida das fundadoras em
  `scripts/test-database.mjs`).
- App: `features/contrato/`, `repositories/contracts.repository.ts`,
  `lib/email/contract-email.ts`, `app/dashboard/configuracoes/contrato/`.
- Configuração guiada: passo "Contrato com a Rota" (só com contrato vigente).

## Ordem do deploy

Aplicar a 0103 **antes** do merge. Sem a migration o painel continua
funcionando (as leituras do contrato caem em "sem contrato"), mas o bloco do
/admin não aparece.

## Fora desta entrega

- Calcular e cobrar a comissão (cartão pelo Mercado Pago, fatura do Pix direto).
- Esconder os dados do hóspede até a aprovação do comprovante.
- PDF anexo no e-mail e selo de fundadora/situação do contrato na lista de
  pousadas do /admin.
