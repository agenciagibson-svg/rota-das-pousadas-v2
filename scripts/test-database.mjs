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
    // 0100: cupons para quem reserva direto (prepara também o teste de concorrência abaixo).
    'cupons-0100.sql',
    // 0101: link de demonstração (captação).
    'demo-link-0101.sql',
    'cadastur-0102.sql',
    // 0103: contrato com aceite eletrônico e fundadoras (prepara a corrida abaixo).
    'contrato-0103.sql',
    // 0104: registro da comissão por reserva e extratos.
    'comissao-0104.sql',
    // 0105: contato do hóspede só depois do pagamento; usa o master de priorities.sql.
    'contato-0105.sql',
    // 0106: origem das reservas; usa o master de priorities.sql.
    'origem-0106.sql',
    // 0107: guia de boas-vindas; usa master e comercial de priorities.sql.
    'guia-0107.sql',
    // 0108: dicas dos leitores; usa master, marketing e comercial de priorities.sql.
    'dicas-0108.sql',
    // 0109: fechamento automático da estadia; usa a recepção de security-0083.sql.
    'fechamento-0109.sql',
    // 0110: cara da pousada no app; usa as reservas de fechamento-0109.sql.
    'cara-0110.sql',
    // 0111: ofertas para ex-hóspedes; usa dono A e recepção de security-0083.sql.
    'ofertas-0111.sql',
    // 0112: ofertas automáticas; usa a pousada B de priorities.sql.
    'ofertas-auto-0112.sql',
    // 0113: guias fora do ar; usa master, marketing e comercial de priorities.sql.
    'guias-0113.sql',
    // 0114: fundadoras a 3%; usa a Pousada Comissão K de comissao-0104.sql.
    'fundadoras-0114.sql',
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
  // 0100: cupom com limite de 1 uso por dois hóspedes ao mesmo tempo, e o
  // mesmo hóspede usando o cupom em duas reservas ao mesmo tempo. A segunda
  // sessão espera o lock da linha do cupom e já enxerga o uso da primeira.
  const concurrentCoupon = readFileSync(`${root}/supabase/tests/concurrent-coupon.sql`, 'utf8')
  const couponSession = (v) =>
    sqlAsync(
      Object.entries(v).reduce((src, [key, value]) => src.replaceAll(key, value), concurrentCoupon),
    )
  const E = {
    USER_ID: 'c0100000-0000-0000-0000-00000000000e',
    GUEST_ID: 'c0100000-0000-0000-0000-00000000040e',
  }
  const F = {
    USER_ID: 'c0100000-0000-0000-0000-00000000000f',
    GUEST_ID: 'c0100000-0000-0000-0000-00000000040f',
  }
  const R = (n) => `c0100000-0000-0000-0000-00000000010${n}`
  const limitRace = await Promise.all([
    couponSession({
      ...E,
      ROOM_ID: R(1),
      CHECKIN: '2096-09-01',
      CHECKOUT: '2096-09-03',
      SUBTOTAL: '1000',
      COUPON: 'CORRIDA',
    }),
    couponSession({
      ...F,
      ROOM_ID: R(2),
      CHECKIN: '2096-09-01',
      CHECKOUT: '2096-09-03',
      SUBTOTAL: '600',
      COUPON: 'CORRIDA',
    }),
  ])
  const onceRace = await Promise.all([
    couponSession({
      ...E,
      ROOM_ID: R(1),
      CHECKIN: '2096-10-01',
      CHECKOUT: '2096-10-03',
      SUBTOTAL: '1000',
      COUPON: 'UNICA',
    }),
    couponSession({
      ...E,
      ROOM_ID: R(3),
      CHECKIN: '2096-10-01',
      CHECKOUT: '2096-10-03',
      SUBTOTAL: '400',
      COUPON: 'UNICA',
    }),
  ])
  if ([...limitRace, ...onceRace].some((result) => result.code !== 0)) {
    throw new Error(`Concorrência de cupons: ${JSON.stringify([...limitRace, ...onceRace])}`)
  }
  sql(`do $$ begin
    if (select count(*) from booking_coupon_redemptions r join pousada_coupons c on c.id = r.coupon_id where c.code = 'CORRIDA' and r.released_at is null) <> 1 then raise exception 'Cupom passou do limite de usos'; end if;
    if (select count(*) from booking_coupon_redemptions r join pousada_coupons c on c.id = r.coupon_id where c.code = 'UNICA' and r.released_at is null) <> 1 then raise exception 'Mesmo hóspede usou o cupom duas vezes'; end if;
    if (select count(*) from bookings where guest_id in ('c0100000-0000-0000-0000-00000000000e', 'c0100000-0000-0000-0000-00000000000f')) <> 2 then raise exception 'Reserva criada sem o cupom'; end if;
  end $$;`)
  console.log('Concorrência de cupons: OK')
  const payment = `select reconcile_marketplace_payment('30000000-0000-0000-0000-000000000001', '999', 1000, 'aprovado', 'pix', 'BRL', '2026-10-01T12:00:00Z', 0);`
  const payments = await Promise.all([sqlAsync(payment), sqlAsync(payment)])
  if (payments.some((result) => result.code !== 0)) throw new Error(JSON.stringify(payments))
  sql(`do $$ begin
    if (select count(*) from payments where provider_ref = '999') <> 1 then raise exception 'Pagamento duplicado'; end if;
    if (select amount_received from bookings where id = '30000000-0000-0000-0000-000000000001') <> 1000 then raise exception 'Saldo duplicado'; end if;
  end $$;`)
  console.log('Concorrência de reservas e webhooks: OK')
  // 0103: duas pousadas com aceite publicadas ao mesmo tempo, com 29 fundadoras
  // já marcadas. Só uma pode ficar com a 30ª posição; a outra é publicada sem
  // a condição de lançamento.
  const publish = (id) =>
    sqlAsync(
      `begin; update pousadas set status = 'publicada' where id = '${id}'; select pg_sleep(1); commit;`,
    )
  const founders = await Promise.all([
    publish('10000000-0000-0000-0000-0000001030f1'),
    publish('10000000-0000-0000-0000-0000001030f2'),
  ])
  if (founders.some((result) => result.code !== 0)) {
    throw new Error(`Concorrência de fundadoras: ${JSON.stringify(founders)}`)
  }
  sql(`do $$ begin
    if (select count(*) from pousadas where founder_rank is not null) <> 30 then raise exception 'Passou de 30 fundadoras'; end if;
    if (select count(*) from pousadas where slug like 'corrida-fundadora-%' and founder_rank = 30 and commission_exempt_until is not null) <> 1 then raise exception 'A 30ª posição não ficou com exatamente uma pousada'; end if;
    if (select count(*) from pousadas where slug like 'corrida-fundadora-%' and status = 'publicada' and first_published_at is not null) <> 2 then raise exception 'Uma das pousadas não foi publicada'; end if;
  end $$;`)
  console.log('Concorrência de fundadoras: OK')
} finally {
  // Remove apenas o container criado por este processo, sem volumes do usuário.
  spawnSync('docker', ['rm', '--force', container], { encoding: 'utf8' })
}
