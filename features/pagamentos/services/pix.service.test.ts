import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  notifyPaymentReviews,
  resolvePaymentReview,
  reviewPaymentProof,
  submitPaymentProof,
} from './pix.service'
import type { BookingNotificationContext } from '@/repositories/bookings.repository'
import type { Role } from '@/lib/auth/rbac'

// A permissão é a de verdade (require-capability + rbac): só a sessão é simulada.
const mocks = vi.hoisted(() => ({
  getActivePousadaId: vi.fn(),
  getActiveTenantRole: vi.fn(),
  getBookingNotificationContextRpc: vi.fn(),
  submitPaymentProofRpc: vi.fn(),
  reviewPaymentProofRpc: vi.fn(),
  resolvePaymentReviewRpc: vi.fn(),
  claimPaymentReviewsToNotify: vi.fn(),
  releasePaymentReviewsNotification: vi.fn(),
  getPousadaAlertEmails: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/auth/tenant-context', () => ({
  getActivePousadaId: mocks.getActivePousadaId,
  getActiveTenantRole: mocks.getActiveTenantRole,
}))
vi.mock('@/repositories/bookings.repository', () => ({
  getBookingNotificationContextRpc: mocks.getBookingNotificationContextRpc,
}))
vi.mock('@/repositories/payments.repository', () => ({
  getPousadaPaymentContextForWebhook: vi.fn(),
  recordPaymentAndConfirmBookingRpc: vi.fn(),
}))
vi.mock('@/repositories/pix.repository', () => ({
  claimPaymentReviewsToNotify: mocks.claimPaymentReviewsToNotify,
  getBookingPixInstructionsRpc: vi.fn(),
  getPixSettingsForPousada: vi.fn(),
  getPousadaAlertEmails: mocks.getPousadaAlertEmails,
  listOpenPaymentReviews: vi.fn(),
  listOpenProofDeadlines: vi.fn(),
  listProofsForBooking: vi.fn(),
  releasePaymentReviewsNotification: mocks.releasePaymentReviewsNotification,
  resolvePaymentReviewRpc: mocks.resolvePaymentReviewRpc,
  reviewPaymentProofRpc: mocks.reviewPaymentProofRpc,
  savePixSettingsRpc: vi.fn(),
  submitPaymentProofRpc: mocks.submitPaymentProofRpc,
}))
vi.mock('@/lib/email/mailer', () => ({ sendEmail: mocks.sendEmail }))

const BOOKING_ID = '30000000-0000-0000-0000-000000000001'
const PROOF_ID = '50000000-0000-0000-0000-000000000001'
const REVIEW_ID = '60000000-0000-0000-0000-000000000001'

function context(overrides: Partial<BookingNotificationContext> = {}): BookingNotificationContext {
  return {
    bookingId: BOOKING_ID,
    code: 'RP-TESTE1',
    guestName: 'Viajante Teste',
    guestEmail: 'viajante@example.test',
    checkin: '2099-10-05',
    checkout: '2099-10-07',
    total: 400,
    currency: 'BRL',
    roomName: 'Duplo',
    paymentDueAt: null,
    pousada: {
      name: 'Pousada Teste',
      slug: 'pousada-teste',
      timezone: 'America/Sao_Paulo',
      address: null,
      cep: null,
      checkinTime: '14:00',
      checkoutTime: '12:00',
      contactPhone: '',
      whatsapp: '',
      houseRules: '',
      cancellationPolicy: '',
    },
    ...overrides,
  }
}

function signedInAs(role: Role | null, pousadaId: string | null = 'pousada-1') {
  mocks.getActivePousadaId.mockResolvedValue(pousadaId)
  mocks.getActiveTenantRole.mockResolvedValue(role)
}

/** Destinatários de todos os e-mails disparados no teste. */
function recipients(): string[] {
  return mocks.sendEmail.mock.calls.map(([params]) => (params as { to: string }).to)
}

function emailTo(to: string): { subject: string; text: string; html: string } {
  const call = mocks.sendEmail.mock.calls.find(([params]) => (params as { to: string }).to === to)
  if (!call) throw new Error(`nenhum e-mail enviado para ${to}`)
  return call[0] as { subject: string; text: string; html: string }
}

async function silenced<T>(run: () => Promise<T>): Promise<{ result: T; logged: number }> {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const result = await run()
    return { result, logged: log.mock.calls.length }
  } finally {
    log.mockRestore()
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  signedInAs('proprietario')
  mocks.getBookingNotificationContextRpc.mockResolvedValue(context())
  mocks.getPousadaAlertEmails.mockResolvedValue(['dono@example.test', 'recepcao@example.test'])
  mocks.sendEmail.mockResolvedValue(true)
  mocks.releasePaymentReviewsNotification.mockResolvedValue(undefined)
})

describe('submitPaymentProof (hóspede envia o comprovante do Pix)', () => {
  const input = {
    bookingId: BOOKING_ID,
    filePath: `${BOOKING_ID}/abcdef123456.jpg`,
    fileName: 'comprovante.jpg',
    mimeType: 'image/jpeg' as const,
    sizeBytes: 120_000,
  }

  beforeEach(() => {
    mocks.submitPaymentProofRpc.mockResolvedValue({ id: PROOF_ID, amount: 400 })
  })

  it('registra o comprovante e avisa o hóspede e toda a equipe da pousada', async () => {
    await submitPaymentProof(input)

    expect(mocks.submitPaymentProofRpc).toHaveBeenCalledWith(input)
    expect(recipients().sort()).toEqual([
      'dono@example.test',
      'recepcao@example.test',
      'viajante@example.test',
    ])
    expect(emailTo('viajante@example.test').subject).toContain('Comprovante recebido')
    expect(emailTo('viajante@example.test').subject).toContain('RP-TESTE1')
  })

  it('reserva sem e-mail do hóspede: só a equipe é avisada', async () => {
    mocks.getBookingNotificationContextRpc.mockResolvedValue(context({ guestEmail: null }))

    await submitPaymentProof(input)

    expect(recipients().sort()).toEqual(['dono@example.test', 'recepcao@example.test'])
  })

  it('pousada sem e-mail de aviso cadastrado: o hóspede ainda recebe a confirmação de envio', async () => {
    mocks.getPousadaAlertEmails.mockResolvedValue([])

    await submitPaymentProof(input)

    expect(recipients()).toEqual(['viajante@example.test'])
  })

  it('falha ao enviar e-mail não derruba o envio do comprovante', async () => {
    mocks.sendEmail.mockRejectedValue(new Error('SMTP fora do ar'))

    const { logged } = await silenced(() => submitPaymentProof(input))

    expect(mocks.submitPaymentProofRpc).toHaveBeenCalledTimes(1)
    expect(logged).toBe(1)
  })

  it('falha ao buscar os dados da reserva para o aviso não derruba o envio', async () => {
    mocks.getBookingNotificationContextRpc.mockRejectedValue(new Error('banco indisponível'))

    const { logged } = await silenced(() => submitPaymentProof(input))

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(logged).toBe(1)
  })

  it('falha ao buscar os e-mails da equipe não derruba o envio', async () => {
    mocks.getPousadaAlertEmails.mockRejectedValue(new Error('banco indisponível'))

    await expect(silenced(() => submitPaymentProof(input))).resolves.toBeDefined()
  })

  it('comprovante recusado pelo banco: o erro chega a quem enviou e ninguém é avisado', async () => {
    mocks.submitPaymentProofRpc.mockRejectedValue(
      new Error('Já existe um comprovante em análise para esta reserva.'),
    )

    await expect(submitPaymentProof(input)).rejects.toThrow(
      'Já existe um comprovante em análise para esta reserva.',
    )
    expect(mocks.getBookingNotificationContextRpc).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})

describe('reviewPaymentProof (equipe confere o comprovante)', () => {
  const approved = {
    bookingId: BOOKING_ID,
    approved: true,
    confirmed: true,
    amount: 400,
    remaining: 0,
  }
  const rejected = {
    bookingId: BOOKING_ID,
    approved: false,
    confirmed: false,
    amount: null,
    remaining: 400,
  }

  describe('aprovar', () => {
    it('aprova com o valor que entrou no extrato e devolve a reserva', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue(approved)

      const result = await reviewPaymentProof({
        proofId: PROOF_ID,
        approve: true,
        reason: '',
        amount: 400,
      })

      expect(result).toEqual({ bookingId: BOOKING_ID })
      expect(mocks.reviewPaymentProofRpc).toHaveBeenCalledWith({
        proofId: PROOF_ID,
        approve: true,
        reason: null,
        amount: 400,
      })
    })

    it('aprova sem informar valor: o banco assume o saldo inteiro da reserva', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue(approved)

      await reviewPaymentProof({ proofId: PROOF_ID, approve: true, reason: '' })

      expect(mocks.reviewPaymentProofRpc).toHaveBeenCalledWith(
        expect.objectContaining({ approve: true, amount: null }),
      )
    })

    it('ao aprovar, um motivo esquecido no formulário não é gravado', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue(approved)

      await reviewPaymentProof({
        proofId: PROOF_ID,
        approve: true,
        reason: 'valor diferente',
        amount: 400,
      })

      expect(mocks.reviewPaymentProofRpc).toHaveBeenCalledWith(
        expect.objectContaining({ reason: null }),
      )
    })

    it('pagamento que quita a reserva: hóspede recebe o e-mail de reserva confirmada', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue(approved)

      await reviewPaymentProof({ proofId: PROOF_ID, approve: true, reason: '', amount: 400 })

      expect(recipients()).toEqual(['viajante@example.test'])
      expect(emailTo('viajante@example.test').subject).toMatch(/confirmada/i)
    })

    it('pagamento parcial: hóspede é avisado de quanto entrou e de quanto falta', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue({
        ...approved,
        confirmed: false,
        amount: 150,
        remaining: 250,
      })

      const result = await reviewPaymentProof({
        proofId: PROOF_ID,
        approve: true,
        reason: '',
        amount: 150,
      })

      expect(result).toEqual({ bookingId: BOOKING_ID })
      expect(recipients()).toEqual(['viajante@example.test'])
      const { text } = emailTo('viajante@example.test')
      expect(text).toMatch(/150,00/)
      expect(text).toMatch(/Falta.*250,00/)
    })

    it('pagamento parcial sem e-mail do hóspede: aprova e não tenta enviar nada', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue({
        ...approved,
        confirmed: false,
        amount: 150,
        remaining: 250,
      })
      mocks.getBookingNotificationContextRpc.mockResolvedValue(context({ guestEmail: null }))

      await expect(
        reviewPaymentProof({ proofId: PROOF_ID, approve: true, reason: '', amount: 150 }),
      ).resolves.toEqual({ bookingId: BOOKING_ID })
      expect(mocks.sendEmail).not.toHaveBeenCalled()
    })
  })

  describe('recusar', () => {
    it('recusa com motivo: o motivo é gravado e chega ao hóspede por e-mail', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue(rejected)

      const result = await reviewPaymentProof({
        proofId: PROOF_ID,
        approve: false,
        reason: 'Valor diferente do combinado',
      })

      expect(result).toEqual({ bookingId: BOOKING_ID })
      expect(mocks.reviewPaymentProofRpc).toHaveBeenCalledWith({
        proofId: PROOF_ID,
        approve: false,
        reason: 'Valor diferente do combinado',
        amount: null,
      })
      expect(recipients()).toEqual(['viajante@example.test'])
      const email = emailTo('viajante@example.test')
      expect(email.subject).toContain('Comprovante não aprovado')
      expect(email.text).toContain('Valor diferente do combinado')
    })

    it('ao recusar, um valor esquecido no formulário não é lançado como recebido', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue(rejected)

      await reviewPaymentProof({
        proofId: PROOF_ID,
        approve: false,
        reason: 'Comprovante ilegível',
        amount: 400,
      })

      expect(mocks.reviewPaymentProofRpc).toHaveBeenCalledWith(
        expect.objectContaining({ approve: false, amount: null }),
      )
    })
  })

  describe('falha de e-mail não derruba a decisão já gravada', () => {
    it('aprovação parcial: SMTP fora do ar ainda devolve a reserva', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue({
        ...approved,
        confirmed: false,
        amount: 150,
        remaining: 250,
      })
      mocks.sendEmail.mockRejectedValue(new Error('SMTP fora do ar'))

      const { result, logged } = await silenced(() =>
        reviewPaymentProof({ proofId: PROOF_ID, approve: true, reason: '', amount: 150 }),
      )

      expect(result).toEqual({ bookingId: BOOKING_ID })
      expect(logged).toBe(1)
    })

    it('recusa: falha ao buscar os dados da reserva ainda devolve a reserva', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue(rejected)
      mocks.getBookingNotificationContextRpc.mockRejectedValue(new Error('banco indisponível'))

      const { result, logged } = await silenced(() =>
        reviewPaymentProof({ proofId: PROOF_ID, approve: false, reason: 'Valor diferente' }),
      )

      expect(result).toEqual({ bookingId: BOOKING_ID })
      expect(mocks.sendEmail).not.toHaveBeenCalled()
      expect(logged).toBe(1)
    })

    it('aprovação total: falha no e-mail de confirmação ainda devolve a reserva', async () => {
      mocks.reviewPaymentProofRpc.mockResolvedValue(approved)
      mocks.sendEmail.mockRejectedValue(new Error('SMTP fora do ar'))

      const { result } = await silenced(() =>
        reviewPaymentProof({ proofId: PROOF_ID, approve: true, reason: '', amount: 400 }),
      )

      expect(result).toEqual({ bookingId: BOOKING_ID })
    })
  })

  describe('permissão', () => {
    it.each<Role>(['proprietario', 'admin_pousada', 'recepcionista', 'financeiro_pousada'])(
      '%s pode conferir comprovante',
      async (role) => {
        signedInAs(role)
        mocks.reviewPaymentProofRpc.mockResolvedValue(approved)

        await expect(
          reviewPaymentProof({ proofId: PROOF_ID, approve: true, reason: '', amount: 400 }),
        ).resolves.toEqual({ bookingId: BOOKING_ID })
      },
    )

    it('governança não confere comprovante — nada é gravado nem enviado', async () => {
      signedInAs('governanca')

      await expect(
        reviewPaymentProof({ proofId: PROOF_ID, approve: true, reason: '', amount: 400 }),
      ).rejects.toThrow('Você não tem permissão para esta ação.')
      expect(mocks.reviewPaymentProofRpc).not.toHaveBeenCalled()
      expect(mocks.sendEmail).not.toHaveBeenCalled()
    })

    it('sem pousada ativa a conferência é recusada', async () => {
      signedInAs(null, null)

      await expect(
        reviewPaymentProof({ proofId: PROOF_ID, approve: true, reason: '', amount: 400 }),
      ).rejects.toThrow('Nenhuma pousada ativa selecionada.')
      expect(mocks.reviewPaymentProofRpc).not.toHaveBeenCalled()
    })
  })

  it('recusa do banco (ex.: comprovante já decidido) chega à tela e o hóspede não é avisado', async () => {
    mocks.reviewPaymentProofRpc.mockRejectedValue(new Error('Este comprovante já foi analisado.'))

    await expect(
      reviewPaymentProof({ proofId: PROOF_ID, approve: true, reason: '', amount: 400 }),
    ).rejects.toThrow('Este comprovante já foi analisado.')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})

describe('resolvePaymentReview (fila "Pagamentos para revisar")', () => {
  const input = { reviewId: REVIEW_ID, resolution: 'Valor devolvido ao hóspede por Pix.' }

  it.each<Role>(['proprietario', 'admin_pousada'])(
    '%s marca o caso como resolvido',
    async (role) => {
      signedInAs(role)

      await resolvePaymentReview(input)

      expect(mocks.resolvePaymentReviewRpc).toHaveBeenCalledWith(
        REVIEW_ID,
        'Valor devolvido ao hóspede por Pix.',
      )
    },
  )

  it.each<Role>(['recepcionista', 'financeiro_pousada', 'governanca'])(
    '%s não encerra caso de revisão',
    async (role) => {
      signedInAs(role)

      await expect(resolvePaymentReview(input)).rejects.toThrow(
        'Você não tem permissão para esta ação.',
      )
      expect(mocks.resolvePaymentReviewRpc).not.toHaveBeenCalled()
    },
  )

  it('recusa do banco chega a quem tentou resolver', async () => {
    mocks.resolvePaymentReviewRpc.mockRejectedValue(new Error('Caso não encontrado.'))

    await expect(resolvePaymentReview(input)).rejects.toThrow('Caso não encontrado.')
  })
})

describe('notifyPaymentReviews (aviso à equipe sobre casos novos)', () => {
  const item = (n: number) => ({
    reviewId: `review-${n}`,
    bookingId: `booking-${n}`,
    kind: 'pix_sem_analise' as const,
    amount: 400,
  })

  it('sem casos novos não envia nada', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([])

    await expect(notifyPaymentReviews()).resolves.toEqual({ notified: 0, failed: 0 })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.releasePaymentReviewsNotification).not.toHaveBeenCalled()
  })

  it('avisa toda a equipe de cada caso, com reserva e valor no assunto', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1), item(2)])

    await expect(notifyPaymentReviews()).resolves.toEqual({ notified: 2, failed: 0 })

    expect(mocks.sendEmail).toHaveBeenCalledTimes(4)
    expect(new Set(recipients())).toEqual(new Set(['dono@example.test', 'recepcao@example.test']))
    const { subject } = emailTo('dono@example.test')
    expect(subject).toContain('Pagamento para revisar')
    expect(subject).toContain('RP-TESTE1')
    expect(subject).toMatch(/400,00/)
  })

  it('quando todos os avisos saem, nenhum caso é devolvido à fila', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1), item(2)])

    await notifyPaymentReviews()

    expect(mocks.releasePaymentReviewsNotification).not.toHaveBeenCalled()
  })

  it('o aviso vai só para a equipe, nunca para o hóspede', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1)])

    await notifyPaymentReviews()

    expect(recipients()).not.toContain('viajante@example.test')
  })

  it('um caso com erro não impede o aviso dos demais e volta para a fila', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1), item(2), item(3)])
    mocks.getPousadaAlertEmails.mockImplementation(async (bookingId: string) => {
      if (bookingId === 'booking-2') throw new Error('banco indisponível')
      return ['dono@example.test']
    })

    const { result } = await silenced(() => notifyPaymentReviews())

    expect(result).toEqual({ notified: 2, failed: 1 })
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
    expect(mocks.releasePaymentReviewsNotification).toHaveBeenCalledTimes(1)
    expect(mocks.releasePaymentReviewsNotification).toHaveBeenCalledWith(['review-2'])
  })

  it('falha ao buscar os dados da reserva de um caso conta como falha e o caso volta para a fila', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1), item(2)])
    mocks.getBookingNotificationContextRpc.mockImplementation(async (bookingId: string) => {
      if (bookingId === 'booking-1') throw new Error('banco indisponível')
      return context()
    })

    const { result } = await silenced(() => notifyPaymentReviews())

    expect(result).toEqual({ notified: 1, failed: 1 })
    expect(mocks.releasePaymentReviewsNotification).toHaveBeenCalledWith(['review-1'])
  })

  it('caso cuja reserva não tem dados para o e-mail é pulado: não conta como avisado nem como falha, e não volta para a fila', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1), item(2)])
    mocks.getBookingNotificationContextRpc.mockImplementation(async (bookingId: string) =>
      bookingId === 'booking-1' ? null : context(),
    )

    await expect(notifyPaymentReviews()).resolves.toEqual({ notified: 1, failed: 0 })
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
    expect(mocks.releasePaymentReviewsNotification).not.toHaveBeenCalled()
  })

  it('falha ao buscar a fila nunca lança (não pode derrubar o webhook nem o cron)', async () => {
    mocks.claimPaymentReviewsToNotify.mockRejectedValue(new Error('banco indisponível'))

    const { result, logged } = await silenced(() => notifyPaymentReviews())

    expect(result).toEqual({ notified: 0, failed: 0 })
    expect(logged).toBe(1)
    expect(mocks.releasePaymentReviewsNotification).not.toHaveBeenCalled()
  })

  // Regressão: `sendEmail` nunca lança — devolve `false` quando o SMTP falha ou
  // não está configurado. Antes o retorno era ignorado e o caso, já marcado
  // como avisado no banco, perdia o alerta para sempre.
  it('caso cujo e-mail não saiu (sendEmail devolve false) não conta como avisado: é falha e volta para a fila', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1)])
    mocks.sendEmail.mockResolvedValue(false)

    const { result } = await silenced(() => notifyPaymentReviews())

    expect(result).toEqual({ notified: 0, failed: 1 })
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
    expect(mocks.releasePaymentReviewsNotification).toHaveBeenCalledWith(['review-1'])
  })

  it('basta um destinatário receber para o caso contar como avisado e não voltar para a fila', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1)])
    mocks.sendEmail.mockImplementation(
      async (params: { to: string }) => params.to === 'recepcao@example.test',
    )

    await expect(notifyPaymentReviews()).resolves.toEqual({ notified: 1, failed: 0 })
    expect(mocks.releasePaymentReviewsNotification).not.toHaveBeenCalled()
  })

  it('envio que lança erro conta como falha e o caso volta para a fila', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1)])
    mocks.sendEmail.mockRejectedValue(new Error('SMTP fora do ar'))

    const { result } = await silenced(() => notifyPaymentReviews())

    expect(result).toEqual({ notified: 0, failed: 1 })
    expect(mocks.releasePaymentReviewsNotification).toHaveBeenCalledWith(['review-1'])
  })

  // Regressão: pousada sem nenhum e-mail de aviso — zero mensagens enviadas,
  // mas o caso era contado como avisado. Agora é só pulado: não há para quem
  // mandar, então reenfileirar não adiantaria (o caso segue no painel).
  it('caso de pousada sem nenhum e-mail de aviso é pulado: não conta como avisado nem como falha, e não volta para a fila', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1)])
    mocks.getPousadaAlertEmails.mockResolvedValue([])

    await expect(notifyPaymentReviews()).resolves.toEqual({ notified: 0, failed: 0 })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.releasePaymentReviewsNotification).not.toHaveBeenCalled()
  })

  it('devolve à fila exatamente os casos que falharam, de uma vez só e na ordem em que falharam', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([
      item(1), // sai
      item(2), // SMTP devolve false
      item(3), // reserva sem dados: pulado
      item(4), // erro ao buscar a equipe
      item(5), // pousada sem e-mail de aviso: pulado
      item(6), // sai
    ])
    mocks.getBookingNotificationContextRpc.mockImplementation(async (bookingId: string) =>
      bookingId === 'booking-3' ? null : context({ bookingId }),
    )
    mocks.getPousadaAlertEmails.mockImplementation(async (bookingId: string) => {
      if (bookingId === 'booking-4') throw new Error('banco indisponível')
      if (bookingId === 'booking-5') return []
      return [`equipe-${bookingId}@example.test`]
    })
    mocks.sendEmail.mockImplementation(
      async (params: { to: string }) => params.to !== 'equipe-booking-2@example.test',
    )

    const { result } = await silenced(() => notifyPaymentReviews())

    expect(result).toEqual({ notified: 2, failed: 2 })
    expect(mocks.releasePaymentReviewsNotification).toHaveBeenCalledTimes(1)
    expect(mocks.releasePaymentReviewsNotification).toHaveBeenCalledWith(['review-2', 'review-4'])
  })

  it('falha ao devolver casos à fila nunca lança e ainda informa quantos falharam', async () => {
    mocks.claimPaymentReviewsToNotify.mockResolvedValue([item(1), item(2)])
    mocks.sendEmail.mockImplementation(
      async (params: { to: string }) => params.to === 'nao-existe@example.test',
    )
    mocks.releasePaymentReviewsNotification.mockRejectedValue(new Error('banco indisponível'))

    const { result } = await silenced(() => notifyPaymentReviews())

    expect(result).toEqual({ notified: 0, failed: 2 })
  })
})
