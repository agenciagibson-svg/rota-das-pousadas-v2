# Contas de teste da equipe: como criar e o que conferir

Este roteiro é para testar, no celular e em produção, o que cada papel da equipe
vê e faz. Tudo é feito pelo próprio painel: sem SQL e sem senha. Cada conta
entra com o código que chega por e-mail.

O mesmo dia de trabalho já roda automaticamente no banco de teste
(`supabase/tests/papeis-equipe.sql`). Aqui você confere as **telas**, que o
teste automático não vê.

## Antes de começar

- **Use uma pousada de teste, nunca a do cliente.** As reservas, pagamentos e
  despesas do teste entram no Financeiro e na auditoria da pousada. Se ainda
  não tiver uma, cadastre em `/anunciar` com a sua conta e publique em `/admin`.
  Cadastre nela duas acomodações e um item de estoque com preço de venda (ex.:
  "Água", R$ 6, com "Mostrar no app do hóspede" ligado). Para o teste do
  Viajante, salve também uma chave Pix em Configurações.
- **E-mails:** o Gmail entrega `agenciagibson+qualquercoisa@gmail.com` na sua
  própria caixa. Use um por papel:

  | Papel no menu Membros | E-mail                               |
  | --------------------- | ------------------------------------ |
  | Gestor                | `agenciagibson+gestor@gmail.com`     |
  | Recepção              | `agenciagibson+recepcao@gmail.com`   |
  | Governança            | `agenciagibson+governanca@gmail.com` |
  | Financeiro            | `agenciagibson+financeiro@gmail.com` |
  | (hóspede comum)       | `agenciagibson+viajante@gmail.com`   |

- **Uma janela anônima por vez.** As abas anônimas do mesmo navegador
  compartilham o login. Termine um papel, feche a janela anônima e abra outra
  para o próximo. Se quiser dois ao mesmo tempo, use navegadores diferentes (por
  exemplo, Chrome anônimo e Safari privado).

## 1. Criar as contas (5 min)

Para cada e-mail da tabela:

1. Abra uma janela anônima em `rotadaspousadas.com.br/login`.
2. Digite o e-mail e toque em **Receber código por e-mail**.
3. Digite o código que chegou no Gmail e toque em **Entrar**. A conta passa a
   existir.
4. Feche a janela anônima.

**A conta precisa existir antes do convite.** Para um e-mail ainda sem conta, o
painel responde "convite enviado", mas não cria o vínculo; ele faz isso de
propósito, para não revelar quem tem conta. Nesse caso, crie a conta e convide
de novo.

## 2. Convidar (3 min)

Com a **sua** conta (proprietário), entre em **Membros**. Em **Convidar**, envie
um convite por e-mail, escolhendo o papel da tabela. A lista mostra cada um como
"Convite pendente".

## 3. Aceitar (1 min por papel)

Em uma janela anônima, entre com o e-mail do papel (código por e-mail) e abra
`/dashboard`. Aparece o convite da pousada; toque em **Aceitar**. Em Membros, na
sua conta, o vínculo passa para "Ativo".

## 4. Roteiro por papel (cerca de 15 min cada, no celular)

Abra o menu pelo ícone de menu, no canto da tela. Em cada papel, confira primeiro o
menu, depois as ações. Se você digitar o endereço de uma área que não está no
menu, deve aparecer "Seu perfil não tem acesso a esta área".

### Recepção

**Menu:** Visão geral, Reservas, Pedidos, Hóspedes, Acomodações, Estoque, Link
da bio, Mensagens. **Não aparecem:** Financeiro, Membros, Avaliações, Marketing,
Assistente, Configurações.

1. **Reservas → Nova reserva:** crie uma reserva de balcão com entrada **hoje**,
   2 noites, situação pendente. O preço sugerido segue as tarifas.
2. Na reserva, toque em **Confirmar** e depois em **Check-in**. O check-in só
   libera a partir da data de entrada. Numa reserva com entrada futura, o botão
   fica desligado.
3. **Registrar pagamento:** registre metade do valor em dinheiro. O saldo cai.
4. **Lançar consumo:** lance 2 águas e depois registre o pagamento do consumo.
5. Registre o restante da diária e toque em **Check-out**.
6. **Acomodações:** a lista aparece, mas sem botão de editar nem de mudar o
   status de limpeza. Em **Tarifas**, as regras aparecem sem "Nova regra".
7. **Estoque:** dá para registrar saída, mas não aparecem "Novo item", o ajuste
   nem os custos.
8. Digite `/dashboard/financeiro` e `/dashboard/membros`: aparece "sem acesso".

### Governança

**Menu:** Visão geral, Pedidos, Acomodações, Estoque. **Não aparecem:**
Reservas, Hóspedes, Financeiro, Membros, Configurações.

1. **Acomodações:** aparece a lista de limpeza, sem preços. Mude o quarto do
   check-out para "Aguardando limpeza", depois "Em limpeza", "Inspeção
   pendente" e "Disponível".
2. **Pedidos:** os pedidos aparecem sem valores. Use **Preparar** e
   **Entregue** num pedido do hóspede (ver Viajante abaixo).
3. **Estoque:** registre uma perda (ex.: 1 garrafa quebrada).
4. **Visão geral:** não mostra faturamento.
5. Digite `/dashboard/reservas` e `/dashboard/hospedes`: aparece "sem acesso".

### Financeiro

**Menu:** Visão geral, Reservas, Financeiro, Estoque. **Não aparecem:**
Acomodações, Pedidos, Hóspedes, Membros, Configurações.

1. **Financeiro:** a receita das reservas, os pagamentos de consumo e as
   despesas aparecem. Em "Lançar despesa", o texto avisa que só o proprietário e
   o gestor lançam.
2. **Reservas:** a lista abre. O botão "Nova reserva" aparece, mas leva a "sem
   acesso" (o financeiro não cria reserva).
3. **Toque numa reserva:** hoje aparece "Não foi possível abrir esta reserva"
   (é um problema conhecido, veja abaixo). Anote se continuar assim.
4. **Visão geral:** a ocupação aparece como "não disponível para o seu perfil".

### Gestor

**Menu:** o mesmo do proprietário. Difere só em Membros e Configurações.

1. **Acomodações:** edite a diária de um quarto. Em **Tarifas**, crie uma regra
   em datas distantes (ex.: Réveillon).
2. **Financeiro:** lance uma despesa e marque-a como paga.
3. **Membros:** a equipe aparece, mas **sem** o bloco "Convidar" e sem os
   botões de trocar papel, suspender ou revogar.
4. **Configurações:** na área "Pagamentos", o gestor não tem botão para conectar
   o Mercado Pago. Hoje aparece "Conecte sua conta" mesmo quando a conta já está
   conectada (problema conhecido, veja abaixo).

### Proprietário (sua conta)

Tudo aparece. Confira os pontos que só o proprietário tem:

1. **Membros:** troque o papel de alguém e depois volte ao papel original.
   Suspenda a Recepção. Na janela da Recepção, recarregue: aparece a tela de
   acesso suspenso. Depois reative a Recepção.
2. **Configurações:** conectar o Mercado Pago e salvar a chave Pix.

### Viajante (hóspede comum)

1. Com `+viajante`, reserve a pousada de teste pelo site (entrada hoje) e envie
   um comprovante Pix.
2. **Recepção:** abra a reserva, aprove o comprovante e faça o check-in.
3. Com `+viajante`, em **Minhas reservas** aparece só esta reserva. Abra a
   estadia e peça 3 águas pelo app.
4. **Governança:** entregue o pedido.
5. O viajante não tem acesso a `/dashboard`.

## Problemas conhecidos (o teste do banco confirmou)

- **Financeiro** não abre o detalhe da reserva: a lista de Reservas aparece, mas
  o detalhe exige permissão de recepção. O botão "Nova reserva" também aparece
  para ele e leva a "sem acesso".
- **Gestor** vê "Conecte sua conta Mercado Pago" mesmo com a conta conectada.
- **Governança e recepção** conseguem ler valores de pedidos e custos de estoque
  se acessarem o banco por fora do app. As telas escondem esses dados.

Os detalhes técnicos estão no relatório da simulação.

## Depois do teste

Em **Membros**, revogue os vínculos de teste, ou deixe a pousada de teste só
para isso. As contas `+alias` podem ficar; elas não têm acesso a nenhuma
pousada real.
