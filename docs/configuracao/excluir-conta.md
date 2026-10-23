# Excluir a própria conta — o que configurar fora do código

1. **Aplicar a migration** `supabase/migrations/0090_excluir_conta.sql` no
   Supabase (SQL Editor ou `supabase db push`). Ela cria a coluna
   `profiles.deleted_at` e a função `delete_my_account()`.
2. **Conferir a chave `SUPABASE_SERVICE_ROLE_KEY` na Vercel** (Production e
   Preview). Ela já existe (auditoria, "esqueci minha senha"); a exclusão usa a
   mesma chave para encerrar o usuário no Supabase Auth. Sem ela, os dados são
   apagados, mas a pessoa vê "não conseguimos encerrar o acesso agora" e o erro
   vai para o Sentry.
3. **Google Play Console** → Conteúdo do app → Segurança dos dados → Exclusão
   de conta: informe `https://rotadaspousadas.com.br/excluir-conta`.
4. **App Store Connect**: nas notas da revisão, cite o caminho no app — Meu
   perfil → Excluir minha conta.
5. **Pedido por e-mail** (quem não consegue entrar):
   1. Confirme que o pedido veio do e-mail da conta e ache o usuário em
      Authentication → Users (copie o id).
   2. No SQL Editor, anonimize como se fosse a própria pessoa (as mesmas
      travas valem — reserva em andamento e dono de pousada são recusados):
      ```sql
      select set_config('request.jwt.claim.sub', '<id do usuário>', true);
      select delete_my_account();
      ```
   3. Em Authentication → Users, use **Ban user** (bloqueia o acesso). Não use
      "Delete user": ele apaga de forma definitiva e o banco recusa quando a
      pessoa tem reserva, avaliação ou registro de auditoria em alguma pousada.
