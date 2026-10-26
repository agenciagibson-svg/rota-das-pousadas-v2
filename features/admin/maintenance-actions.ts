'use server'

import { z } from 'zod'
import { createAction } from '@/actions/create-action'
import {
  backfillGuestProfilesAdmin,
  previewMonthlyReportAdmin,
} from './services/maintenance.service'

/** Prévia do relatório do mês de uma pousada, só para quem clicou — só master. */
export const previewMonthlyReportAction = createAction(
  z.object({ pousadaId: z.string().uuid('Escolha uma pousada.') }),
  async ({ pousadaId }) => previewMonthlyReportAdmin(pousadaId),
)

/** Completa fichas antigas de hóspede pelo perfil do viajante — só master. */
export const backfillGuestProfilesAction = createAction(z.object({}), async () =>
  backfillGuestProfilesAdmin(),
)
