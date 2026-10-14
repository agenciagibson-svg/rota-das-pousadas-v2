import { SiteHeader } from '@/components/site-header'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'

export default function PousadaLoading() {
  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="pb-24">
        <Container className="pt-28">
          <div className="grid grid-cols-1 gap-2 md:h-[520px] md:grid-cols-4 md:grid-rows-2">
            <Skeleton className="h-64 rounded-3xl md:col-span-2 md:row-span-2 md:h-full" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="hidden h-full min-h-[120px] rounded-3xl md:block" />
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-2/3 max-w-md" />
            <Skeleton className="h-4 w-52" />
          </div>

          <div className="mt-10 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
            <div className="flex flex-col gap-4">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-96 w-full rounded-3xl" />
          </div>
        </Container>
      </main>
    </div>
  )
}
