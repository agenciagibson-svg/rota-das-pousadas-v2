import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FormPageShell } from '@/components/layout/form-page-shell'
import { AdminCreatePousadaForm } from '@/features/admin/components/admin-create-pousada-form'
import { getCurrentUser } from '@/server/queries'
import { can } from '@/lib/auth/rbac'

export const metadata: Metadata = {
  title: 'Cadastrar pousada — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminNovaPousadaPage() {
  // `platformRole` já é garantido pelo layout do grupo protegido — aqui só a
  // autorização específica desta página (nem todo admin pode criar pousada).
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'pousada:create')) redirect('/admin')

  return (
    <FormPageShell
      eyebrow="Equipe Rota das Pousadas"
      title="Cadastrar pousada"
      description="Use o Instagram da pousada como referência para preencher os dados e subir as fotos. O proprietário poderá assumir o painel depois."
      backHref="/admin"
      backLabel="Voltar ao painel admin"
    >
      <AdminCreatePousadaForm />
    </FormPageShell>
  )
}
