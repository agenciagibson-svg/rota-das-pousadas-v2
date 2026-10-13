import type { Metadata } from 'next'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { OwnerDashboardView } from '@/components/dashboard/owner-dashboard-view'
import { DemoNotice } from '@/components/demo/demo-notice'
import { buildDemoOwnerDashboard } from '@/features/gestao/demo'
import { isSupabaseConfigured } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Painel da pousada — demonstração',
  robots: { index: false, follow: false },
}

/**
 * Visão geral do painel da pousada com reservas fictícias, para conhecer a
 * gestão no preview (sem banco conectado). Com o Supabase configurado, leva
 * ao painel real (que pede o login da pousada).
 */
export default async function PainelDemonstracaoPage() {
  if (isSupabaseConfigured()) redirect('/dashboard')
  await connection()
  const data = buildDemoOwnerDashboard(new Date())

  return (
    <OwnerDashboardView
      {...data}
      alertsSlot={
        <DemoNotice action={{ href: '/parceiros/login', label: 'Entrar como pousada' }}>
          Os números abaixo são calculados a partir de reservas de exemplo. Com o login da pousada,
          o painel mostra a sua casa — e libera reservas, acomodações, financeiro e equipe.
        </DemoNotice>
      }
    />
  )
}
