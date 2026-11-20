import { manifestResponse } from '@/features/app-fases/manifest'

/** Manifesto legado de quem instalou o antigo "Minha estadia" (ver features/app-fases/manifest.ts). */
export function GET() {
  return manifestResponse('/estadia')
}
