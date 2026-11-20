import { redirect } from 'next/navigation'
import { getMyAppState } from '@/server/queries'
import { phaseEntryPath } from '@/features/app-fases/phase'

export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

/**
 * Porta de entrada do app instalado (start_url do manifesto). Decide a fase a
 * cada abertura: estadia ou viagem marcada → app da pousada; mais de uma
 * estadia em curso → escolher; pós-estadia e loja → a loja (a home mostra o
 * cartão da fase). Sem login, ou se algo falhar, abre a loja.
 */
export default async function AppEntryPage() {
  let target = '/'
  try {
    target = phaseEntryPath((await getMyAppState()).phase)
  } catch (e) {
    console.error('[app] falha ao decidir a fase', e)
  }
  redirect(target)
}
