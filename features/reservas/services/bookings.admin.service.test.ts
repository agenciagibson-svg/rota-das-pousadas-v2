import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setAdminBookingCompanions, updateAdminBooking } from './bookings.service'
import type { SetBookingCompanionsInput, UpdateBookingInput } from '@/features/reservas/schemas'
import type { Role } from '@/lib/auth/rbac'

// A permissão é a de verdade (require-capability + rbac): só a sessão é simulada.
const mocks = vi.hoisted(() => ({
  getActivePousadaId: vi.fn(),
  getActiveTenantRole: vi.fn(),
  getBookingPousadaId: vi.fn(),
  hasUnreadableCompanionDocuments: vi.fn(),
  updateBookingRpc: vi.fn(),
  setBookingCompanionsRpc: vi.fn(),
}))

vi.mock('@/lib/auth/tenant-context', () => ({
  getActivePousadaId: mocks.getActivePousadaId,
  getActiveTenantRole: mocks.getActiveTenantRole,
}))
vi.mock('@/features/auth/services/auth.service', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/features/auth/services/profile.service', () => ({ getMyProfile: vi.fn() }))
vi.mock('@/repositories/rooms.repository', () => ({ getBookableRoomBySlug: vi.fn() }))
vi.mock('@/repositories/guests.repository', () => ({
  ensureTravelerGuestRpc: vi.fn(),
  upsertGuestRpc: vi.fn(),
}))
vi.mock('@/repositories/bookings.repository', () => ({
  createBookingRpc: vi.fn(),
  getBookingByGuest: vi.fn(),
  getBookingNotificationContextRpc: vi.fn(),
  getBookingPousadaId: mocks.getBookingPousadaId,
  hasUnreadableCompanionDocuments: mocks.hasUnreadableCompanionDocuments,
  listBookingsByGuest: vi.fn(),
  setBookingCompanionsRpc: mocks.setBookingCompanionsRpc,
  setBookingStatusRpc: vi.fn(),
  updateBookingRpc: mocks.updateBookingRpc,
}))
vi.mock('@/lib/email/mailer', () => ({ sendEmail: vi.fn() }))

const ACTIVE_POUSADA = 'pousada-ativa'
const OTHER_POUSADA = 'pousada-de-outro-dono'
const BOOKING_ID = '30000000-0000-0000-0000-000000000001'

function signedInAs(role: Role | null, pousadaId: string | null = ACTIVE_POUSADA) {
  mocks.getActivePousadaId.mockResolvedValue(pousadaId)
  mocks.getActiveTenantRole.mockResolvedValue(role)
}

beforeEach(() => {
  vi.resetAllMocks()
  signedInAs('recepcionista')
  mocks.getBookingPousadaId.mockResolvedValue(ACTIVE_POUSADA)
  mocks.hasUnreadableCompanionDocuments.mockResolvedValue(false)
  mocks.updateBookingRpc.mockResolvedValue({ version: 4 })
  mocks.setBookingCompanionsRpc.mockResolvedValue({ version: 4 })
})

describe('updateAdminBooking (edição da reserva pela equipe)', () => {
  const input: UpdateBookingInput = {
    bookingId: BOOKING_ID,
    version: 3,
    roomId: '20000000-0000-0000-0000-000000000001',
    guestId: '40000000-0000-0000-0000-000000000001',
    checkin: '2099-10-05',
    checkout: '2099-10-08',
    adults: 2,
    children: 1,
    infants: 0,
    pets: false,
    nightlyRate: 200,
    discount: 50,
    surcharge: 30,
    servicesAmount: 20,
    origin: 'balcao',
    expectedArrivalTime: '15:00',
    specialRequests: 'Berço no quarto',
    internalNotes: 'Cliente antigo',
  }

  it('salva a edição e devolve a nova versão da reserva', async () => {
    await expect(updateAdminBooking(input)).resolves.toEqual({ version: 4 })

    expect(mocks.updateBookingRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: BOOKING_ID,
        version: 3,
        roomId: input.roomId,
        responsibleGuestId: input.guestId,
        checkin: '2099-10-05',
        checkout: '2099-10-08',
        adults: 2,
        children: 1,
        origin: 'balcao',
        expectedArrivalTime: '15:00',
        specialRequests: 'Berço no quarto',
        internalNotes: 'Cliente antigo',
      }),
    )
  })

  it('recalcula o preço no servidor: diária × noites − desconto + acréscimo + serviços', async () => {
    await updateAdminBooking(input)

    // 3 noites × 200 = 600; 600 − 50 + 30 + 20 = 600. Sem taxa de serviço (SaaS).
    expect(mocks.updateBookingRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: 600,
        fee: 0,
        discount: 50,
        surcharge: 30,
        servicesAmount: 20,
        total: 600,
      }),
    )
  })

  it('ignora subtotal e total que venham adulterados do formulário', async () => {
    const tampered = { ...input, subtotal: 1, total: 1, fee: 0 } as UpdateBookingInput

    await updateAdminBooking(tampered)

    expect(mocks.updateBookingRpc).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 600, total: 600 }),
    )
  })

  it('mudar as datas muda o total (o preço acompanha o novo período)', async () => {
    await updateAdminBooking({
      ...input,
      checkout: '2099-10-06',
      discount: 0,
      surcharge: 0,
      servicesAmount: 0,
    })

    expect(mocks.updateBookingRpc).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 200, total: 200 }),
    )
  })

  it('desconto maior que a hospedagem não gera total negativo', async () => {
    await updateAdminBooking({ ...input, discount: 5000, surcharge: 0, servicesAmount: 0 })

    expect(mocks.updateBookingRpc).toHaveBeenCalledWith(expect.objectContaining({ total: 0 }))
  })

  it('campos opcionais vazios: horário de chegada vira nulo e as observações ficam em branco', async () => {
    await updateAdminBooking({
      ...input,
      expectedArrivalTime: '',
      specialRequests: undefined,
      internalNotes: '',
    })

    expect(mocks.updateBookingRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedArrivalTime: null,
        specialRequests: '',
        internalNotes: '',
      }),
    )
  })

  it('recusa reserva de OUTRA pousada sem chamar a RPC', async () => {
    mocks.getBookingPousadaId.mockResolvedValue(OTHER_POUSADA)

    await expect(updateAdminBooking(input)).rejects.toThrow('Reserva não encontrada nesta pousada.')
    expect(mocks.getBookingPousadaId).toHaveBeenCalledWith(BOOKING_ID)
    expect(mocks.updateBookingRpc).not.toHaveBeenCalled()
  })

  it('recusa reserva inexistente (ou invisível pela RLS) sem chamar a RPC', async () => {
    mocks.getBookingPousadaId.mockResolvedValue(null)

    await expect(updateAdminBooking(input)).rejects.toThrow('Reserva não encontrada nesta pousada.')
    expect(mocks.updateBookingRpc).not.toHaveBeenCalled()
  })

  it.each<Role>(['proprietario', 'admin_pousada', 'recepcionista'])(
    '%s pode editar reserva',
    async (role) => {
      signedInAs(role)

      await expect(updateAdminBooking(input)).resolves.toEqual({ version: 4 })
    },
  )

  it.each<Role>(['financeiro_pousada', 'governanca'])(
    '%s não edita reserva — nem chega a consultar a reserva',
    async (role) => {
      signedInAs(role)

      await expect(updateAdminBooking(input)).rejects.toThrow(
        'Você não tem permissão para esta ação.',
      )
      expect(mocks.getBookingPousadaId).not.toHaveBeenCalled()
      expect(mocks.updateBookingRpc).not.toHaveBeenCalled()
    },
  )

  it('sem pousada ativa a edição é recusada', async () => {
    signedInAs(null, null)

    await expect(updateAdminBooking(input)).rejects.toThrow('Nenhuma pousada ativa selecionada.')
    expect(mocks.updateBookingRpc).not.toHaveBeenCalled()
  })

  it('conflito de versão vindo do banco chega a quem editou', async () => {
    mocks.updateBookingRpc.mockRejectedValue(
      new Error('A reserva foi alterada por outra pessoa. Recarregue a página.'),
    )

    await expect(updateAdminBooking(input)).rejects.toThrow(
      'A reserva foi alterada por outra pessoa. Recarregue a página.',
    )
  })
})

describe('setAdminBookingCompanions (ficha de hóspedes da reserva)', () => {
  const input: SetBookingCompanionsInput = {
    bookingId: BOOKING_ID,
    version: 3,
    companions: [
      {
        fullName: 'Maria Aparecida da Silva',
        guestType: 'responsible',
        hasSpecialNeeds: false,
        documentType: 'cpf',
        documentNumber: '000.000.000-00',
      },
      { fullName: 'João da Silva', guestType: 'child', hasSpecialNeeds: false },
    ],
  }

  it('grava os acompanhantes da reserva e devolve a nova versão', async () => {
    await expect(setAdminBookingCompanions(input)).resolves.toEqual({ version: 4 })

    expect(mocks.setBookingCompanionsRpc).toHaveBeenCalledWith(BOOKING_ID, 3, input.companions)
  })

  it('antes de gravar, confere se os documentos já salvos desta reserva são legíveis', async () => {
    await setAdminBookingCompanions(input)

    expect(mocks.hasUnreadableCompanionDocuments).toHaveBeenCalledTimes(1)
    expect(mocks.hasUnreadableCompanionDocuments).toHaveBeenCalledWith(BOOKING_ID)
    expect(mocks.hasUnreadableCompanionDocuments.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setBookingCompanionsRpc.mock.invocationCallOrder[0],
    )
  })

  it('documento já salvo que não decifra neste ambiente: bloqueia a alteração para não apagar o original', async () => {
    mocks.hasUnreadableCompanionDocuments.mockResolvedValue(true)

    await expect(setAdminBookingCompanions(input)).rejects.toThrow(
      /^Não foi possível ler os documentos já salvos desta reserva/,
    )
    expect(mocks.setBookingCompanionsRpc).not.toHaveBeenCalled()
  })

  it('o bloqueio vale mesmo quando a nova ficha vem sem nenhum documento', async () => {
    mocks.hasUnreadableCompanionDocuments.mockResolvedValue(true)

    await expect(
      setAdminBookingCompanions({
        ...input,
        companions: [{ fullName: 'João da Silva', guestType: 'child', hasSpecialNeeds: false }],
      }),
    ).rejects.toThrow(/^Não foi possível ler os documentos já salvos desta reserva/)
    expect(mocks.setBookingCompanionsRpc).not.toHaveBeenCalled()
  })

  it('falha ao conferir os documentos salvos não deixa a alteração passar', async () => {
    mocks.hasUnreadableCompanionDocuments.mockRejectedValue(new Error('banco indisponível'))

    await expect(setAdminBookingCompanions(input)).rejects.toThrow('banco indisponível')
    expect(mocks.setBookingCompanionsRpc).not.toHaveBeenCalled()
  })

  it('recusa reserva de OUTRA pousada sem chamar a RPC', async () => {
    mocks.getBookingPousadaId.mockResolvedValue(OTHER_POUSADA)

    await expect(setAdminBookingCompanions(input)).rejects.toThrow(
      'Reserva não encontrada nesta pousada.',
    )
    expect(mocks.hasUnreadableCompanionDocuments).not.toHaveBeenCalled()
    expect(mocks.setBookingCompanionsRpc).not.toHaveBeenCalled()
  })

  it('recusa reserva inexistente sem chamar a RPC', async () => {
    mocks.getBookingPousadaId.mockResolvedValue(null)

    await expect(setAdminBookingCompanions(input)).rejects.toThrow(
      'Reserva não encontrada nesta pousada.',
    )
    expect(mocks.setBookingCompanionsRpc).not.toHaveBeenCalled()
  })

  it.each<Role>(['financeiro_pousada', 'governanca'])(
    '%s não altera a ficha de hóspedes (documentos pessoais)',
    async (role) => {
      signedInAs(role)

      await expect(setAdminBookingCompanions(input)).rejects.toThrow(
        'Você não tem permissão para esta ação.',
      )
      expect(mocks.getBookingPousadaId).not.toHaveBeenCalled()
      expect(mocks.hasUnreadableCompanionDocuments).not.toHaveBeenCalled()
      expect(mocks.setBookingCompanionsRpc).not.toHaveBeenCalled()
    },
  )

  it('falha ao consultar a reserva não deixa a alteração passar', async () => {
    mocks.getBookingPousadaId.mockRejectedValue(new Error('banco indisponível'))

    await expect(setAdminBookingCompanions(input)).rejects.toThrow('banco indisponível')
    expect(mocks.setBookingCompanionsRpc).not.toHaveBeenCalled()
  })
})
