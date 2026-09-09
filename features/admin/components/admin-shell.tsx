'use client'

import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard/shell'
import { adminNav, type AdminSection } from '../admin-nav'

/**
 * Wrapper client-side pras telas do admin que não são a Visão Geral.
 *
 * `adminNav()` monta um array com componentes de ícone (funções) — passar
 * isso direto de uma Server Component pra `DashboardShell` (client) quebra
 * em produção ("Functions cannot be passed directly to Client Components").
 * Por isso o nav só é montado AQUI DENTRO, já em client-side; a página só
 * atravessa a fronteira com `active` (string) e `children` (JSX), que são
 * serializáveis. Mesmo padrão de `features/gestao/components/owner-settings-view.tsx`.
 */
export function AdminShell({
  active,
  title,
  subtitle,
  displayName,
  children,
}: {
  active: AdminSection
  title: string
  subtitle: string
  displayName: string
  children: ReactNode
}) {
  return (
    <DashboardShell
      nav={adminNav(active)}
      brandLabel="Rota Admin"
      brandSub="Painel Master"
      title={title}
      subtitle={subtitle}
      accent="ocean"
      user={{ name: displayName, role: 'Administrador' }}
    >
      {children}
    </DashboardShell>
  )
}
