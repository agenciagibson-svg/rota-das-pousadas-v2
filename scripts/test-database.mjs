import { spawnSync, spawn } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const container = `rota-db-test-${process.pid}`
function docker(args, input) {
  const result = spawnSync('docker', args, { cwd: root, input, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout
}
function sql(source) {
  return docker(
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    source,
  )
}
function sqlAsync(source) {
  return new Promise((resolve) => {
    const child = spawn('docker', [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ])
    let output = ''
    child.stdout.on('data', (data) => {
      output += data
    })
    child.stderr.on('data', (data) => {
      output += data
    })
    child.on('close', (code) => resolve({ code, output }))
    child.stdin.end(source)
  })
}
try {
  docker([
    'run',
    '--detach',
    '--name',
    container,
    '--env',
    'POSTGRES_PASSWORD=local-test-only',
    'postgres:17',
  ])
  let ready = false
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker(['exec', container, 'pg_isready', '-U', 'postgres'])
      ready = true
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  if (!ready) throw new Error('Postgres de teste não iniciou.')
  sql(readFileSync(`${root}/supabase/tests/bootstrap.sql`, 'utf8'))
  for (const file of readdirSync(`${root}/supabase/migrations`)
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    // O `;` avulso fecha uma última instrução sem ponto e vírgula (a CLI do
    // Supabase aceita) antes do COMMIT, que senão vira parte dela (0060).
    sql(`BEGIN;\n${readFileSync(`${root}/supabase/migrations/${file}`, 'utf8')}\n;\nCOMMIT;`)
    console.log(`migration ${file}: OK`)
  }
  sql(readFileSync(`${root}/supabase/tests/priorities.sql`, 'utf8'))
  console.log('Disponibilidade, pagamentos e isolamento: OK')
  // 0083: papéis de plataforma, trava de login, Pix, estoque/consumo. Depende
  // dos dados criados por priorities.sql, então roda logo depois.
  sql(readFileSync(`${root}/supabase/tests/security-0083.sql`, 'utf8'))
  console.log('Segurança 0083: OK')
  // Melhorias de out/2026 (0087–0094) e a simulação dos papéis da equipe. Cada arquivo usa ids próprios e roda
  // sobre os dados de priorities.sql.
  for (const file of [
    'tarifas-0087.sql',
    'pre-check-in.sql',
    'pedido-avaliacao.sql',
    'excluir-conta.sql',
    'auth-google-codigo.sql',
    'papeis-equipe.sql',
    // 0094: calendário com preço por dia e link da reserva para o acompanhante.
    'calendario-compartilhar-0094.sql',
    // 0095: mapa (coordenadas da pousada).
    'mapa-0095.sql',
    // 0096: mapa de ocupação (mover reserva).
    'mover-reserva-0096.sql',
    // 0097: relatório do mês por e-mail e fichas completadas pelo perfil.
    'relatorio-mensal-0097.sql',
  ]) {
    sql(readFileSync(`${root}/supabase/tests/${file}`, 'utf8'))
    console.log(`${file}: OK`)
  }
  const concurrentBooking = readFileSync(`${root}/supabase/tests/concurrent-booking.sql`, 'utf8')
  const bookings = await Promise.all([
    sqlAsync(concurrentBooking.replaceAll('CONCURRENT_CODE', 'RACE-A')),
    sqlAsync(concurrentBooking.replaceAll('CONCURRENT_CODE', 'RACE-B')),
  ])
  if (
    bookings.filter((result) => result.code === 0).length !== 1 ||
    !bookings.some((result) => result.output.includes('bookings_no_overlap'))
  ) {
    throw new Error(`Concorrência de reservas: ${JSON.stringify(bookings)}`)
  }
  // 0096: duas mudanças para o mesmo quarto/datas — a segunda espera o lock do
  // quarto e é recusada pela checagem (com o código da primeira), não pela EXCLUDE.
  const concurrentMove = readFileSync(`${root}/supabase/tests/concurrent-move.sql`, 'utf8')
  const moves = await Promise.all([
    sqlAsync(concurrentMove.replaceAll('MOVE_ID', '96300000-0000-0000-0000-0000000000a1')),
    sqlAsync(concurrentMove.replaceAll('MOVE_ID', '96300000-0000-0000-0000-0000000000a2')),
  ])
  if (
    moves.filter((result) => result.code === 0).length !== 1 ||
    !moves.some((result) => /Já existe uma reserva \(RACE-MOV-[12]\)/.test(result.output))
  ) {
    throw new Error(`Concorrência ao mover reservas: ${JSON.stringify(moves)}`)
  }
  const payment = `select reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '999', 1000, 'aprovado', 'pix', 'BRL', '2026-10-01T12:00:00Z', 0);`
  const payments = await Promise.all([sqlAsync(payment), sqlAsync(payment)])
  if (payments.some((result) => result.code !== 0)) throw new Error(JSON.stringify(payments))
  sql(`do $$ begin
    if (select count(*) from payments where provider_ref = '999') <> 1 then raise exception 'Pagamento duplicado'; end if;
    if (select amount_received from bookings where id = '30000000-0000-0000-0000-000000000001') <> 1000 then raise exception 'Saldo duplicado'; end if;
  end $$;`)
  console.log('Concorrência de reservas e webhooks: OK')
} finally {
  // Remove apenas o container criado por este processo, sem volumes do usuário.
  spawnSync('docker', ['rm', '--force', container], { encoding: 'utf8' })
}
