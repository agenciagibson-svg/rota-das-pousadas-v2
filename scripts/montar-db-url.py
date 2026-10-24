"""Monta a URL do banco para o `supabase db push` do GitHub Actions.

Aceita no segredo SUPABASE_DB_URL qualquer um destes formatos:
  - só a senha;
  - a URL do "Session pooler" com a senha;
  - a URL da conexão direta (db.<ref>.supabase.co), que o GitHub não alcança
    (é só IPv6): ela é trocada pelo pooler;
  - a senha entre colchetes, como vem no exemplo do Supabase ([YOUR-PASSWORD]).

A senha é codificada para URL (caracteres especiais quebravam a conexão).
Escreve a URL pronta em $GITHUB_ENV como DB_URL, mascarada no log.
"""

import os
import re
import sys
from urllib.parse import quote, unquote

REF = 'vfhkjfcoivyzaftwdjzl'
POOLER = 'aws-0-us-west-2.pooler.supabase.com'


def fail(msg: str) -> None:
    print(f'::error::{msg}')
    sys.exit(1)


raw = os.environ.get('SUPABASE_DB_URL', '').strip().strip('"').strip("'").strip()
if not raw:
    fail('Falta o segredo SUPABASE_DB_URL (Settings → Secrets and variables → Actions).')

if re.match(r'^postgres(ql)?://', raw):
    m = re.match(r'^postgres(?:ql)?://([^:/@]+):(.*)@([^@/:]+)(?::\d+)?/', raw)
    if not m:
        fail('O segredo parece uma URL, mas sem usuário/senha/servidor. Cole só a senha.')
    password = m.group(2)
else:
    password = raw

password = password.strip()
if password.startswith('[') and password.endswith(']'):
    password = password[1:-1]
password = unquote(password)

if not password or password.upper() in {'SENHA_NOVA', 'SUA_SENHA', 'YOUR-PASSWORD'}:
    fail('O segredo ainda tem o texto de exemplo no lugar da senha. Cole a senha do banco.')

url = f'postgresql://postgres.{REF}:{quote(password, safe="")}@{POOLER}:5432/postgres'
print(f'::add-mask::{password}')
print(f'::add-mask::{quote(password, safe="")}')
with open(os.environ['GITHUB_ENV'], 'a', encoding='utf-8') as env:
    env.write(f'DB_URL={url}\n')
print('URL do banco montada (pooler de sessão, senha codificada).')
