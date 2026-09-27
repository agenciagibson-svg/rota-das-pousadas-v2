'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Role } from '@/lib/auth/rbac'

const DashboardRoleContext = createContext<Role | null>(null)

/** Papel do usuário na pousada ativa — o menu e o rótulo do usuário usam. */
export function DashboardRoleProvider({ role, children }: { role: Role; children: ReactNode }) {
  return <DashboardRoleContext.Provider value={role}>{children}</DashboardRoleContext.Provider>
}

export function useDashboardRole(): Role | null {
  return useContext(DashboardRoleContext)
}
