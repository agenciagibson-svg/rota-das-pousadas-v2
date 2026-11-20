# Guia de links (boas-vindas da pousada)

Passo a passo para a pousada colocar os links com a origem marcada (0106) no
perfil do Google, na bio do Instagram e no WhatsApp. Texto único em
`features/origem/guide.ts`, usado em três lugares:

- **Painel da pousada** → Link da bio: quadro "Como colocar os links", logo abaixo
  dos links (`features/origem/components/links-guide.tsx`).
- **E-mail de boas-vindas** (`lib/email/welcome-guide-email.ts`): já com os 3 links
  da pousada no corpo.
- **WhatsApp**: o admin abre o wa.me da pousada com o texto pronto e envia.

## Envio (migration 0107)

- `platform_settings.welcome_guide_auto` (padrão: ligado). Só o master muda, em
  /admin → Configurações → "Guia de links para pousadas novas".
- Automático: ao publicar a pousada (aprovação ou mudança de status) e ao vincular
  o proprietário de uma pousada já publicada. Uma vez por pousada (não reenvia se já
  houve envio por e-mail). Nunca derruba a publicação: erro vai para o Sentry.
- Manual: /admin → Pousadas → "Guia de links" (comercial e master), por e-mail ou
  WhatsApp. Pousada não publicada não recebe (os links levariam a uma página fora do ar).
- Histórico em `pousada_welcome_guide_sends` (canal, automático/manual, quem, quando;
  do e-mail, só o domínio).
