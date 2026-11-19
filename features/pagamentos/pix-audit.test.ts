import { describe, expect, it } from 'vitest'
import { approvedDiffers, sortAuditItems, type PlatformPixAuditItem } from './pix-audit'

// Dados sintéticos.
const item = (over: Partial<PlatformPixAuditItem>): PlatformPixAuditItem => ({
  proofId: 'p',
  bookingId: 'b',
  bookingCode: 'RP-1',
  bookingStatus: 'confirmed',
  checkin: '2099-01-10',
  checkout: '2099-01-12',
  bookingTotal: 500,
  pousadaId: 'x',
  pousadaName: 'Pousada Sintética',
  amount: 500,
  approvedAmount: 500,
  status: 'approved',
  createdAt: '2099-01-01T10:00:00Z',
  reviewedAt: null,
  rejectionReason: null,
  cancelledAfterApproval: false,
  url: null,
  ...over,
})

describe('auditoria de comprovantes (0105)', () => {
  it('cancelada depois de aprovada vem primeiro, depois em análise, depois o resto por data', () => {
    const sorted = sortAuditItems([
      item({ proofId: 'antigo', createdAt: '2099-01-01T10:00:00Z' }),
      item({ proofId: 'analise', status: 'submitted', approvedAmount: null }),
      item({ proofId: 'novo', createdAt: '2099-01-05T10:00:00Z' }),
      item({ proofId: 'cancelada', cancelledAfterApproval: true, bookingStatus: 'cancelled' }),
    ])
    expect(sorted.map((i) => i.proofId)).toEqual(['cancelada', 'analise', 'novo', 'antigo'])
  })

  it('aponta valor aprovado diferente do informado', () => {
    expect(approvedDiffers(item({ approvedAmount: 300 }))).toBe(true)
    expect(approvedDiffers(item({ approvedAmount: 500 }))).toBe(false)
    expect(approvedDiffers(item({ status: 'submitted', approvedAmount: null }))).toBe(false)
  })
})
