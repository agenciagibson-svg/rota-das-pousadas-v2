# Entrar com Google e com código por e-mail — configuração

O código já está pronto. Para funcionar em produção, faça os passos abaixo nos
painéis (Google Cloud, Supabase e Vercel). Nada disso exige migration.

- **Código por e-mail**: funciona assim que os modelos de e-mail (passo 3)
  mostrarem o código. Não tem variável para ligar.
- **Google**: o botão só aparece com `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`
  (passo 5). Ligue a variável **por último**, depois de testar o provedor.
- No navegador do Instagram, Facebook e TikTok o botão do Google não aparece,
  porque o Google recusa login dentro desses apps. Ali o código por e-mail é o
  caminho principal.

## 1. Google Cloud: criar o cliente OAuth

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) e crie
   (ou escolha) o projeto "Rota das Pousadas".
2. **APIs e serviços → Tela de consentimento OAuth** (Google Auth Platform →
   Branding):
   - Tipo de usuário: **Externo**.
   - Nome do app: `Rota das Pousadas`; e-mail de suporte; logo (opcional).
   - Domínios autorizados: `rotadaspousadas.com.br` e `supabase.co`.
   - Links da política de privacidade (`https://rotadaspousadas.com.br/privacidade`)
     e dos termos (`https://rotadaspousadas.com.br/termos`).
   - Escopos (Data Access): só `openid`, `.../auth/userinfo.email` e
     `.../auth/userinfo.profile`. Nenhum escopo sensível, então não precisa
     de verificação do Google.
   - Publique o app (**Publicar app / In production**). Em "Testing", só os
     e-mails cadastrados como testadores conseguem entrar.
3. **Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**.
   - **Origens JavaScript autorizadas**: `https://rotadaspousadas.com.br`.
   - **URIs de redirecionamento autorizados**: a URL de callback **do Supabase**,
     não a do site. Ela aparece no Supabase em _Authentication → Sign In /
     Providers → Google_ ("Callback URL (for OAuth)"), no formato
     `https://<ref-do-projeto>.supabase.co/auth/v1/callback`.
4. Copie o **ID do cliente** e a **chave secreta do cliente**.

## 2. Supabase: ligar o provedor Google

1. _Authentication → Sign In / Providers → Google_: ligue **Enable Sign in with
   Google**, cole o Client ID e o Client Secret e salve.
2. **Não** ligue "Skip nonce checks". Ele só serve para login nativo no celular.

## 3. Supabase: URLs permitidas

_Authentication → URL Configuration_:

- **Site URL**: `https://rotadaspousadas.com.br`
- **Redirect URLs** (adicione todas):
  - `https://rotadaspousadas.com.br/auth/callback`
  - `https://rotadaspousadas.com.br/auth/callback?**`
  - `https://rotadaspousadas.com.br/auth/confirm`
  - `https://*-<time-na-vercel>.vercel.app/**` (previews da Vercel. Copie o
    final do endereço de um preview real, por exemplo
    `rota-git-branch-<time-na-vercel>.vercel.app`)
  - `http://localhost:3000/**` (desenvolvimento)

O app sempre manda a pessoa de volta para `…/auth/callback?next=/pousada/…`.
Se o endereço não estiver na lista, o Supabase devolve para a Site URL e a
pessoa perde a reserva que estava fazendo.

## 4. Supabase: modelos de e-mail (código de 6 números)

O Supabase usa o mesmo envio para "link mágico" e "código". O que muda é o
modelo. Quando a conta ainda não existe, o primeiro e-mail sai pelo modelo
**Confirm signup**; para quem já tem conta, sai pelo **Magic Link**. Por isso,
ajuste **os dois** em _Authentication → Emails → Templates_.

Corpo sugerido (vale para os dois; o link é opcional, o código é o principal):

```html
<h2>Seu código de acesso</h2>
<p>Use este código para entrar na Rota das Pousadas:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Ele vale por 1 hora. Se não foi você, ignore este e-mail.</p>
<p>
  Ou toque para entrar:
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}"
    >entrar na minha conta</a
  >
</p>
```

Assunto sugerido: `Seu código de acesso: {{ .Token }}`

Como cada parte funciona:

- `{{ .Token }}`: o código de 6 números que a pessoa digita na tela de login.
- `{{ .TokenHash }}` + `/auth/confirm`: o link abre uma página com o botão
  "Entrar". O link só é usado no toque, para que o antivírus ou a
  pré-visualização do e-mail não o gastem antes da pessoa. Link e código são o
  mesmo token: usar um invalida o outro.
- `next={{ .RedirectTo }}`: o `RedirectTo` é o `…/auth/callback?next=/pousada/…`
  que o app manda. A página `/auth/confirm` só aceita esse endereço quando ele é
  do próprio site e tira dele o caminho da reserva. Qualquer outro destino cai
  em "Minhas reservas".
- Se o modelo continuar com o `{{ .ConfirmationURL }}` padrão, também funciona:
  o link passa pelo Supabase e volta em `/auth/callback?code=…`. Mas só funciona
  **no mesmo navegador** em que a pessoa pediu o código. Por isso o código e o
  `/auth/confirm` são o caminho recomendado. O cadastro com senha
  (`/cadastro`) continua funcionando com o modelo novo do **Confirm signup**.

Em _Authentication → Sign In / Providers → Email_:

- **Email OTP Length**: `6` (a tela aceita exatamente 6 números).
- **Email OTP Expiration**: `3600` (1 hora) ou menos.
- Mantenha **Confirm email** ligado.

### E-mail de verdade (SMTP)

O servidor de e-mail embutido do Supabase **só entrega para e-mails da equipe
do projeto** e tem limite baixo por hora. Para hóspedes reais, configure SMTP
próprio em _Authentication → Emails → SMTP Settings_ (Resend, Brevo, Amazon SES
ou o próprio Gmail do piloto: `smtp.gmail.com`, porta 465, senha de app). Depois,
em _Authentication → Rate Limits_, ajuste "emails per hour" (o padrão com SMTP
próprio é 30/h, pouco para tráfego de anúncio).

## 5. Vercel: ligar o botão do Google

Em _Settings → Environment Variables_ do projeto:

| Variável                          | Valor  | Ambientes                                                 |
| --------------------------------- | ------ | --------------------------------------------------------- |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | `true` | Production (e Preview, se o preview usa o mesmo Supabase) |

Variável `NEXT_PUBLIC_*` só vale depois de um **novo deploy** (Redeploy).
Confira também se `NEXT_PUBLIC_SITE_URL=https://rotadaspousadas.com.br` está
em Production: é para lá que o Google e o link do e-mail devolvem a pessoa.

## 6. Teste depois de configurar

Faça em aba anônima, no celular e no computador:

1. Abra uma pousada → **Reservar** sem estar logado. A tela de login abre com
   "Para reservar, entre com seu e-mail…" e o campo de e-mail em destaque.
2. Peça o código com um e-mail novo. O código chega? Digite e confira se volta
   para a mesma reserva, com as datas. Como a conta é nova, a reserva pede para
   **Completar cadastro** (CPF, celular…) e depois volta para a reserva.
3. Peça outro código e erre 5 vezes. Na 6ª tentativa deve aparecer "Muitas
   tentativas de login…" (a mesma trava do login com senha, 15 minutos).
4. Repita com o link do e-mail em vez do código.
5. **Continuar com Google** (fora do Instagram): escolha a conta, volte para a
   reserva, e confira se o nome do Google aparece em _Minha conta_.
6. Abra o link da reserva **pelo Instagram** (direct ou bio). O botão do Google
   não aparece e o código por e-mail funciona.

Se o Google voltar com "Não foi possível concluir a entrada", confira os passos
1.3 (URI do Supabase no Google) e 3 (Redirect URLs).
