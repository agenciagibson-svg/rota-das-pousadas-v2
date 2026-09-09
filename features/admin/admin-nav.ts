import { BarChart3, Building2, Globe, LayoutDashboard, Settings, Users } from 'lucide-react'
import type { NavItem } from '@/components/dashboard/shell'

export type AdminSection = 'overview' | 'pousadas' | 'anfitrioes' | 'destinos' | 'relatorios' | 'configuracoes'

export function adminNav(active: AdminSection): NavItem[] {
  return [
    { label: 'Visão Geral', icon: LayoutDashboard, href: '/admin', active: active === 'overview' },
    { label: 'Pousadas', icon: Building2, href: '/admin/pousadas', active: active === 'pousadas' },
    { label: 'Anfitriões', icon: Users, href: '/admin/anfitrioes', active: active === 'anfitrioes' },
    { label: 'Destinos', icon: Globe, href: '/admin/destinos', active: active === 'destinos' },
    { label: 'Relatórios', icon: BarChart3, href: '/admin/relatorios', active: active === 'relatorios' },
    { label: 'Configurações', icon: Settings, href: '/admin/configuracoes', active: active === 'configuracoes' },
  ]
}
