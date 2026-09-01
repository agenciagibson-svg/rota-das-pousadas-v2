import { Loading } from '@/components/ui/loading'

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40">
      <Loading label="Carregando seu painel…" size="lg" />
    </div>
  )
}
