'use server'

import { z } from 'zod'
import { createAction } from '@/actions/create-action'
import { getConnectAuthorizationUrl } from './services/oauth.service'

/** Inicia a conexão OAuth com o Mercado Pago — só `payment:connect_account` (ver requireCapability). */
export const connectMercadoPagoAction = createAction(z.object({}), async () => {
  const url = await getConnectAuthorizationUrl()
  return { redirectTo: url }
})
