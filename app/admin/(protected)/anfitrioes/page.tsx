import type { Metadata } from 'next'
import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/shell'
import { adminNav } from '@/features/admin/admin-nav'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Users } from 'lucide-react'
import { listHostsAdmin } from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Anfitriões — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminAnfitrioesPage() {
  const [user, hosts] = await Promise.all([getCurrentUser(), listHostsAdmin()])

  return (
    <DashboardShell
      nav={adminNav('anfitrioes')}
      brandLabel="Rota Admin"
      brandSub="Painel Master"
      title="Anfitriões"
      subtitle="Proprietários ativos em toda a plataforma"
      accent="ocean"
      user={{ name: user?.name || user?.email || 'Equipe', role: 'Administrador' }}
    >
      <Card className="p-6">
        {hosts.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum anfitrião ainda" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">E-mail</th>
                  <th className="pb-2 pr-4 font-medium">Pousada</th>
                  <th className="pb-2 font-medium">Desde</th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((h) => (
                  <tr key={`${h.userId}-${h.pousadaId}`} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{h.fullName}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{h.email}</td>
                    <td className="py-2.5 pr-4">
                      <Link href={`/pousada/${h.pousadaSlug}`} className="text-ocean hover:underline">
                        {h.pousadaName}
                      </Link>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardShell>
  )
}
