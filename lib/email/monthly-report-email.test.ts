import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ publicEnv: { siteUrl: 'https://rotadaspousadas.com.br' } }))

import { monthlyReportEmail } from './monthly-report-email'
import { buildMonthlyReport, type ReportBooking } from '@/features/dashboard/monthly-report'

const b = (
  checkin: string,
  checkout: string,
  total: number,
  origin: ReportBooking['origin'],
  status: ReportBooking['status'] = 'checked_out',
): ReportBooking => ({ checkin, checkout, total, status, origin })

const bookings: ReportBooking[] = [
  b('2026-09-10', '2026-09-12', 600, 'rota_das_pousadas'),
  b('2026-09-20', '2026-09-23', 900, 'airbnb'),
  b('2026-09-25', '2026-09-26', 300, 'balcao'),
  b('2026-08-05', '2026-08-07', 500, 'booking_com'),
]

const report = buildMonthlyReport({
  pousadaName: 'Pousada <Sol> & Mar',
  bookings,
  totalRooms: 2,
  month: '2026-09-01',
})

describe('e-mail "Relatório do mês"', () => {
  it('assunto com mês e pousada; números, comparação e origens no HTML', () => {
    const email = monthlyReportEmail(report)
    expect(email.subject).toBe('Resumo de setembro de 2026 — Pousada <Sol> & Mar')
    // Nome vindo do banco é escapado.
    expect(email.html).toContain('Pousada &lt;Sol&gt; &amp; Mar')
    expect(email.html).not.toContain('Pousada <Sol>')
    expect(email.html).toContain('Como foi setembro')
    expect(email.html).toContain('comparado com agosto')
    expect(email.html).toContain(`${report.current.occupancyRate}%`)
    expect(email.html).toMatch(/R\$\s1\.800,00/)
    expect(email.html).toContain('Diária média')
    expect(email.html).toContain('De onde vieram as reservas')
    expect(email.html).toContain('Airbnb')
    expect(email.html).toContain('Balcão')
    expect(email.html).toContain('Rota das Pousadas')
    // Seta e percentual da comparação (receita 1.800 vs 500 = +260%).
    expect(email.html).toContain('&#9650; +260%')
    expect(email.html).toContain('https://rotadaspousadas.com.br/dashboard')
    expect(email.html).toContain('Abrir o painel')
    expect(email.html).toContain('proprietário ou gestor')
  })

  it('texto puro com os mesmos números, para cliente sem HTML', () => {
    const { text } = monthlyReportEmail(report)
    expect(text.split('\n')[0]).toBe('Resumo de setembro de 2026 — Pousada <Sol> & Mar')
    expect(text).toMatch(/Receita: R\$\s1\.800,00 \(↑ \+260% vs\. agosto\)/)
    expect(text).toContain('Reservas: 3 (↑ +200% vs. agosto)')
    expect(text).toMatch(/- Airbnb: 1 reserva · R\$\s900,00/)
    expect(text).toContain('Painel: https://rotadaspousadas.com.br/dashboard')
  })

  it('queda aparece com seta para baixo', () => {
    const down = buildMonthlyReport({
      pousadaName: 'Refúgio da Serra',
      bookings: [
        b('2026-09-10', '2026-09-11', 100, 'balcao'),
        b('2026-08-10', '2026-08-12', 400, 'balcao'),
      ],
      totalRooms: 1,
      month: '2026-09-01',
    })
    const email = monthlyReportEmail(down)
    expect(email.html).toContain('&#9660; −75%')
    expect(email.html).toContain('do <strong>Refúgio da Serra</strong>')
  })

  it('mês sem movimento: e-mail curto, sem tabela de números', () => {
    const empty = buildMonthlyReport({
      pousadaName: 'Pousada Sol',
      bookings: [],
      totalRooms: 2,
      month: '2026-09-01',
    })
    const email = monthlyReportEmail(empty)
    expect(email.subject).toBe('Resumo de setembro de 2026 — Pousada Sol')
    expect(email.html).toContain('Setembro sem reservas')
    expect(email.html).toContain(
      'Não houve reservas com entrada em setembro na <strong>Pousada Sol</strong>',
    )
    expect(email.html).not.toContain('Diária média')
    expect(email.text).toContain('Não houve reservas com entrada em setembro')
  })

  it('prévia do admin: assunto marcado e aviso de que nada foi enviado à pousada', () => {
    const email = monthlyReportEmail(report, { preview: true })
    expect(email.subject.startsWith('[Prévia] ')).toBe(true)
    expect(email.html).toContain('Nada foi marcado como enviado')
    expect(email.text.split('\n')[0]).toContain('Prévia')
  })
})
