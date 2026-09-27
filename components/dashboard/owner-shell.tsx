'use client'

import type { ComponentProps } from 'react'
import { DashboardShell } from './shell'
import { ownerDashboardNav, type OwnerDashboardSection } from './owner-nav'

/**
 * `DashboardShell` para páginas renderizadas no servidor. O menu tem ícones
 * (componentes do lucide-react), e componente não atravessa a fronteira
 * servidor → cliente como prop: o Next.js derruba a página com "Functions
 * cannot be passed directly to Client Components". Aqui só a seção (string)
 * cruza a fronteira, e o menu é montado já do lado do cliente.
 *
 * Views que já são 'use client' podem continuar usando `DashboardShell` +
 * `ownerDashboardNav` direto.
 */
export function OwnerDashboardShell({
  section,
  ...props
}: Omit<ComponentProps<typeof DashboardShell>, 'nav'> & { section: OwnerDashboardSection }) {
  return <DashboardShell nav={ownerDashboardNav(section)} {...props} />
}
