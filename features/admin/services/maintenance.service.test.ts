import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  logAudit: vi.fn(),
  sendMonthlyReportPreview: vi.fn(),
  backfillGuestProfilesFromTravelers: vi.fn(),
}))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/audit/log', () => ({ logAudit: mocks.logAudit }))
vi.mock('@/features/dashboard/services/monthly-report.service', () => ({
  sendMonthlyReportPreview: mocks.sendMonthlyReportPreview,
}))
vi.mock('@/features/hospedes/services/guest-profile-backfill.service', () => ({
  backfillGuestProfilesFromTravelers: mocks.backfillGuestProfilesFromTravelers,
}))

import { backfillGuestProfilesAdmin, previewMonthlyReportAdmin } from './maintenance.service'

const POUSADA = '10000000-0000-0000-0000-000000009701'
const master = { id: 'u-master', email: 'master@example.test', platformRole: 'master' }

describe('ferramentas de manutenção do /admin (só master)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.logAudit.mockResolvedValue(undefined)
    mocks.sendMonthlyReportPreview.mockResolvedValue({ status: 'enviado', month: '2026-09-01' })
    mocks.backfillGuestProfilesFromTravelers.mockResolvedValue({
      completed: 3,
      failed: 0,
      documentsSkipped: 0,
      hasMore: false,
    })
  })

  it.each([
    ['sem sessão', null],
    ['dono de pousada', { id: 'u1', email: 'dono@example.test', platformRole: null }],
    ['equipe comercial', { id: 'u2', email: 'c@example.test', platformRole: 'comercial' }],
    ['suporte', { id: 'u3', email: 's@example.test', platformRole: 'suporte' }],
  ])('%s não usa nenhuma das duas', async (_label, user) => {
    mocks.getCurrentUser.mockResolvedValue(user)

    await expect(previewMonthlyReportAdmin(POUSADA)).rejects.toThrow('Só o master')
    await expect(backfillGuestProfilesAdmin()).rejects.toThrow('Só o master')
    expect(mocks.sendMonthlyReportPreview).not.toHaveBeenCalled()
    expect(mocks.backfillGuestProfilesFromTravelers).not.toHaveBeenCalled()
  })

  it('prévia vai só para o e-mail do master que clicou, com auditoria', async () => {
    mocks.getCurrentUser.mockResolvedValue(master)

    await previewMonthlyReportAdmin(POUSADA)

    expect(mocks.sendMonthlyReportPreview).toHaveBeenCalledWith(POUSADA, 'master@example.test')
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'u-master',
        action: 'admin.monthly_report.preview',
        targetId: POUSADA,
      }),
    )
  })

  it('completar fichas devolve as contagens e registra quem rodou', async () => {
    mocks.getCurrentUser.mockResolvedValue(master)

    expect(await backfillGuestProfilesAdmin()).toMatchObject({ completed: 3, failed: 0 })
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'u-master', action: 'admin.guests.profile_backfill' }),
    )
  })
})
