import { Loading } from '@/components/ui/loading'

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loading label="Preparando sua rota…" size="lg" />
    </div>
  )
}
