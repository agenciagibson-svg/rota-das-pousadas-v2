'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Notice } from '@/features/dashboard/notices'

const DashboardNoticesContext = createContext<Notice[] | null>(null)

/**
 * Avisos do sino, calculados no servidor pelo layout do painel da pousada.
 * Fora do painel da pousada (ex.: /admin) não há provider e o sino não aparece.
 */
export function DashboardNoticesProvider({
  notices,
  children,
}: {
  notices: Notice[]
  children: ReactNode
}) {
  return (
    <DashboardNoticesContext.Provider value={notices}>{children}</DashboardNoticesContext.Provider>
  )
}

export function useDashboardNotices(): Notice[] | null {
  return useContext(DashboardNoticesContext)
}
