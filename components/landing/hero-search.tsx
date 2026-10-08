'use client'

import { useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { SearchField } from '@/components/ui/search-field'
import { cn } from '@/lib/utils'
import { addDays, shortDate, todayIso, type SeasonKey } from './seasons'

type Props = { season: SeasonKey; tags: string[] }

/** Os quatro campos da busca. `prefix` evita ids repetidos entre a barra e a folha. */
function Fields({ tone, prefix }: { tone: 'light' | 'dark'; prefix: string }) {
  const today = todayIso()
  const tomorrow = addDays(today, 1)
  const dayAfterTomorrow = addDays(today, 2)
  return (
    <>
      <SearchField
        tone={tone}
        id={`${prefix}-busca`}
        label="Destino"
        name="busca"
        placeholder="Cidade, pousada ou estilo"
        autoComplete="off"
      />
      <SearchField
        tone={tone}
        id={`${prefix}-checkin`}
        label="Check-in"
        name="checkin"
        type="date"
        min={today}
        defaultValue={tomorrow}
      />
      <SearchField
        tone={tone}
        id={`${prefix}-checkout`}
        label="Check-out"
        name="checkout"
        type="date"
        min={dayAfterTomorrow}
        defaultValue={dayAfterTomorrow}
      />
      <SearchField
        tone={tone}
        id={`${prefix}-hospedes`}
        label="Hóspedes"
        name="hospedes"
        type="number"
        min={1}
        max={12}
        defaultValue={2}
      />
    </>
  )
}

function SeasonTags({ tags, tone }: { tags: string[]; tone: 'light' | 'dark' }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          'text-sm font-medium',
          tone === 'dark' ? 'text-primary-foreground/75' : 'text-muted-foreground',
        )}
      >
        Sugestões da estação:
      </span>
      {tags.map((tag) => (
        <Button
          key={tag}
          type="submit"
          name="busca"
          value={tag}
          variant={tone === 'dark' ? 'glass' : 'outline'}
          size="pill-sm"
        >
          {tag}
        </Button>
      ))}
    </div>
  )
}

/** Desktop: barra de vidro com os campos lado a lado e o botão Ipê. */
export function HeroSearchBar({ season, tags, trailing }: Props & { trailing?: ReactNode }) {
  return (
    <form action="/pousadas" method="get" className="hidden flex-col gap-4 lg:flex">
      <input type="hidden" name="temporada" value={season} />
      <div className="glass-dark shadow-premium grid grid-cols-[1.3fr_1fr_1fr_0.7fr_auto] items-center gap-1 rounded-full border p-2">
        <Fields tone="dark" prefix="barra" />
        <Button type="submit" variant="accent" size="pill-lg" className="ml-1">
          <Search className="size-5" />
          Encontrar meu refúgio
        </Button>
      </div>
      <div className="flex items-center justify-between gap-6">
        <SeasonTags tags={tags} tone="dark" />
        {trailing}
      </div>
    </form>
  )
}

/**
 * Celular: uma pílula com o resumo da busca abre a folha com os campos — o
 * hero não vira um formulário de quatro andares em 390px.
 */
export function HeroSearchSheet({ season, tags }: Props) {
  const [open, setOpen] = useState(false)
  const today = todayIso()
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="bg-card text-foreground shadow-premium flex w-full items-center gap-3 rounded-full py-2 pr-2 pl-5 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-semibold">Cidade, pousada ou estilo</span>
          <span className="text-muted-foreground truncate text-sm">
            {shortDate(addDays(today, 1))} a {shortDate(addDays(today, 2))} · 2 hóspedes
          </span>
        </span>
        <span className="bg-accent text-accent-foreground flex size-12 shrink-0 items-center justify-center rounded-full">
          <Search className="size-5" />
          <span className="sr-only">Encontrar meu refúgio</span>
        </span>
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        title="Encontrar meu refúgio"
        className="pb-8"
      >
        <form action="/pousadas" method="get" className="flex flex-col gap-3">
          <input type="hidden" name="temporada" value={season} />
          <Fields tone="light" prefix="folha" />
          <div className="pt-2">
            <SeasonTags tags={tags} tone="light" />
          </div>
          <Button type="submit" variant="accent" size="pill-lg" className="mt-3 w-full">
            <Search className="size-5" />
            Encontrar meu refúgio
          </Button>
        </form>
      </Drawer>
    </div>
  )
}
