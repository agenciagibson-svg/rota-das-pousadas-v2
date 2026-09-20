'use server'

import { z } from 'zod'
import { createAction } from '@/actions/create-action'
import { getConnectAuthorizationUrl } from './services/oauth.service'
import { startSubscriptionAuthorization } from './services/subscription.service'

/** Inicia a conexão OAuth com o Mercado Pago — só `payment:connect_account` (ver requireCapability). */
export const connectMercadoPagoAction = createAction(z.object({}), async () => {
  const url = await getConnectAuthorizationUrl()
  return { redirectTo: url }
})

/** Inicia a autorização da assinatura da plataforma — só `subscription:manage` (proprietario/master). */
export const startSubscriptionAuthorizationAction = createAction(z.object({}), async () => {
  const { initPoint } = await startSubscriptionAuthorization()
  return { redirectTo: initPoint }
})
