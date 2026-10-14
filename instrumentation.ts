import type { Instrumentation } from 'next'

/**
 * Erros de render, Route Handlers e Server Actions que escapam do tratamento
 * do app chegam aqui (o Next chama este gancho no servidor). Vai para o Sentry
 * quando `SENTRY_DSN` existe; sem a variável, nada muda — o erro continua no
 * log da Vercel. Ver lib/observability/report-error.ts.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // Import dinâmico: o módulo usa `node:crypto`, e este arquivo também é
  // carregado no runtime edge.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { reportError } = await import('@/lib/observability/report-error')
  await reportError(error, {
    where: `request:${context.routeType}`,
    route: context.routePath,
    tags: { method: request.method, digest: (error as { digest?: string }).digest },
  })
}
