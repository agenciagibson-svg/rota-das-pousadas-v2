import type { Metadata } from 'next'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { listHostsAdmin } from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Anfitriões — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminAnfitrioesPage() {
  const [user, hosts] = await Promise.all([getCurrentUser(), listHostsAdmin()])

  return (
    <AdminShell
      active="anfitrioes"
      title="Anfitriões"
      subtitle="Proprietários ativos em toda a plataforma"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <Card className="p-6">
        {hosts.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum anfitrião ainda" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs font-medium">
                  <th className="pr-4 pb-2 font-medium">Nome</th>
                  <th className="pr-4 pb-2 font-medium">E-mail</th>
                  <th className="pr-4 pb-2 font-medium">Pousada</th>
                  <th className="pb-2 font-medium">Desde</th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((h) => (
                  <tr
                    key={`${h.userId}-${h.pousadaId}`}
                    className="border-border/60 border-b last:border-0"
                  >
                    <td className="text-foreground py-2.5 pr-4 font-medium">{h.fullName}</td>
                    <td className="text-muted-foreground py-2.5 pr-4">{h.email}</td>
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/pousada/${h.pousadaSlug}`}
                        className="text-ocean hover:underline"
                      >
                        {h.pousadaName}
                      </Link>
                    </td>
                    <td className="text-muted-foreground py-2.5">
                      {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminShell>
  )
}
