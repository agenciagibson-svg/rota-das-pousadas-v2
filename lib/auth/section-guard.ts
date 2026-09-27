import 'server-only'
import { getActiveTenantRole } from './tenant-context'
import { canAccessSection, type DashboardSection } from './dashboard-sections'

/** `true` quando o papel ativo NÃO pode abrir esta área do painel. */
export async function sectionDenied(section: DashboardSection): Promise<boolean> {
  const role = await getActiveTenantRole()
  return !canAccessSection(role, section)
}
