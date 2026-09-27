import {
  BedDouble,
  Bot,
  CalendarCheck,
  ConciergeBell,
  LayoutDashboard,
  Link2,
  Megaphone,
  Package,
  MessageSquare,
  Settings,
  Star,
  UserRound,
  Users2,
  Wallet,
} from 'lucide-react'
import type { NavItem } from './shell'

export type OwnerDashboardSection =
  | 'overview'
  | 'reservas'
  | 'hospedes'
  | 'financeiro'
  | 'acomodacoes'
  | 'link'
  | 'membros'
  | 'mensagens'
  | 'avaliacoes'
  | 'marketing'
  | 'assistente'
  | 'configuracoes'
  | 'pedidos'
  | 'estoque'

export function ownerDashboardNav(active: OwnerDashboardSection): NavItem[] {
  return [
    {
      label: 'Visão geral',
      icon: LayoutDashboard,
      href: '/dashboard',
      active: active === 'overview',
    },
    {
      label: 'Reservas',
      icon: CalendarCheck,
      href: '/dashboard/reservas',
      active: active === 'reservas',
    },
    {
      label: 'Pedidos',
      icon: ConciergeBell,
      href: '/dashboard/pedidos',
      active: active === 'pedidos',
    },
    {
      label: 'Hóspedes',
      icon: UserRound,
      href: '/dashboard/hospedes',
      active: active === 'hospedes',
    },
    {
      label: 'Financeiro',
      icon: Wallet,
      href: '/dashboard/financeiro',
      active: active === 'financeiro',
    },
    {
      label: 'Acomodações',
      icon: BedDouble,
      href: '/dashboard/acomodacoes',
      active: active === 'acomodacoes',
    },
    {
      label: 'Estoque',
      icon: Package,
      href: '/dashboard/estoque',
      active: active === 'estoque',
    },
    {
      label: 'Link da bio',
      icon: Link2,
      href: '/dashboard/link',
      active: active === 'link',
    },
    {
      label: 'Membros',
      icon: Users2,
      href: '/dashboard/membros',
      active: active === 'membros',
    },
    {
      label: 'Mensagens',
      icon: MessageSquare,
      href: '/dashboard/mensagens',
      active: active === 'mensagens',
    },
    {
      label: 'Avaliações',
      icon: Star,
      href: '/dashboard/avaliacoes',
      active: active === 'avaliacoes',
    },
    {
      label: 'Marketing',
      icon: Megaphone,
      href: '/dashboard/marketing',
      active: active === 'marketing',
    },
    {
      label: 'Assistente',
      icon: Bot,
      href: '/dashboard/assistente',
      active: active === 'assistente',
    },
    {
      label: 'Configurações',
      icon: Settings,
      href: '/dashboard/configuracoes',
      active: active === 'configuracoes',
    },
  ]
}
