import { beforeEach, describe, expect, it, vi } from 'vitest'
import { unblockCalendarDay } from './room-blocks.repository'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ from: mocks.from, rpc: mocks.rpc }),
}))

/** Linhas como o PostgREST devolve `timestamptz`: `+00:00`, sem milissegundos. */
function setupBlocks(rows: { id: string; starts_at: string; ends_at: string }[]) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockResolvedValue({ data: rows, error: null }),
  }
  mocks.from.mockReturnValue(query)
  mocks.rpc.mockResolvedValue({ error: null })
}

describe('unblockCalendarDay', () => {
  beforeEach(() => {
    mocks.from.mockReset()
    mocks.rpc.mockReset()
  })

  it('cancela o bloqueio de um dia criado pelo calendário', async () => {
    setupBlocks([
      {
        id: 'block-1',
        starts_at: '2026-10-05T00:00:00+00:00',
        ends_at: '2026-10-06T00:00:00+00:00',
      },
    ])

    await unblockCalendarDay('pousada-1', 'room-1', '2026-10-05')

    expect(mocks.rpc).toHaveBeenCalledWith('cancel_room_block', {
      p_pousada_id: 'pousada-1',
      p_block_id: 'block-1',
      p_cancellation_reason: 'Desbloqueado pelo calendário de reservas.',
    })
  })

  it('não cancela um bloqueio maior a partir de um clique de um dia', async () => {
    setupBlocks([
      {
        id: 'block-2',
        starts_at: '2026-10-04T00:00:00+00:00',
        ends_at: '2026-10-08T00:00:00+00:00',
      },
    ])

    await expect(unblockCalendarDay('pousada-1', 'room-1', '2026-10-05')).rejects.toThrow(
      'Este dia faz parte de um bloqueio maior',
    )
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('não faz nada quando o dia já está livre', async () => {
    setupBlocks([])

    await unblockCalendarDay('pousada-1', 'room-1', '2026-10-05')

    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
