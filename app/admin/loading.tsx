import { Loading } from '@/components/ui/loading'

export default function AdminLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40">
      <Loading label="Carregando o painel executivo…" size="lg" />
    </div>
  )
}
