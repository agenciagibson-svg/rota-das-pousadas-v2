import { manifestResponse } from '@/features/app-fases/manifest'

/**
 * Manifesto do site e do app instalado, em `/site.webmanifest`. Não use
 * `app/manifest.ts` nem uma rota `app/manifest.webmanifest`: o Next trata os
 * dois como manifesto da raiz e ele vence o `metadata.manifest` de qualquer
 * layout. O link vem de `baseMetadata` (lib/seo.ts) e do layout de /estadia.
 */
export function GET() {
  return manifestResponse('/')
}
