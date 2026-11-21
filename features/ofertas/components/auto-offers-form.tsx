'use client'

import { useState, useTransition } from 'react'
import { CalendarHeart, PartyPopper, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AutoOffers } from '@/repositories/offers.repository'
import { saveAutoOffersAction } from '../actions'

const PERCENTS = [5, 10, 15, 20, 25, 30]

const ROWS: {
  key: keyof AutoOffers
  title: string
  hint: string
  icon: typeof Repeat
}[] = [
  {
    key: 'seisMeses',
    title: 'Faz 6 meses',
    hint: 'Para quem saiu daqui há 6 meses. Vale 30 dias.',
    icon: Repeat,
  },
  {
    key: 'feriado',
    title: 'Feriado chegando',
    hint: 'Cerca de 45 dias antes de cada feriadão, para estadias no feriadão.',
    icon: CalendarHeart,
  },
  {
    key: 'aniversario',
    title: '1 ano da estadia',
    hint: 'Um ano depois da estadia. Vale 30 dias.',
    icon: PartyPopper,
  },
]

/**
 * Ofertas automáticas (0112): a pousada liga cada uma e escolhe o desconto; a
 * rodada das 10h cria e manda. Mesmos limites da oferta manual.
 */
export function AutoOffersForm({ initial }: { initial: AutoOffers }) {
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const dirty = JSON.stringify(value) !== JSON.stringify(initial)

  function save() {
    setSaved(null)
    setError(null)
    startTransition(async () => {
      const res = await saveAutoOffersAction(value)
      if (!res.ok) setError(res.error)
      else setSaved('Salvo. As ofertas ligadas saem na rodada das 10h.')
    })
  }

  return (
    <div className="border-border mt-6 border-t pt-5">
      <h3 className="text-foreground text-sm font-semibold">Ofertas automáticas</h3>
      <p className="text-muted-foreground mt-1 text-xs">
        Ligue e esqueça: a Rota manda na hora certa, só para quem autorizou.
      </p>
      <ul className="mt-3 space-y-2">
        {ROWS.map(({ key, title, hint, icon: Icon }) => {
          const row = value[key]
          return (
            <li
              key={key}
              className="bg-secondary grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-2xl p-3 sm:grid-cols-[auto_1fr_auto]"
            >
              <Icon className="text-primary size-5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">{title}</p>
                <p className="text-muted-foreground text-xs">{hint}</p>
              </div>
              <div className="col-start-2 flex items-center justify-between gap-3 sm:col-start-3 sm:justify-end">
                <select
                  aria-label={`Desconto: ${title}`}
                  className="border-input bg-card text-foreground h-10 rounded-xl border px-2 text-sm outline-none disabled:opacity-50"
                  value={row.percent}
                  disabled={!row.on}
                  onChange={(e) =>
                    setValue({ ...value, [key]: { ...row, percent: Number(e.target.value) } })
                  }
                >
                  {PERCENTS.map((p) => (
                    <option key={p} value={p}>
                      {p}%
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.on}
                  aria-label={title}
                  onClick={() => setValue({ ...value, [key]: { ...row, on: !row.on } })}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${row.on ? 'bg-primary' : 'bg-border'}`}
                >
                  <span
                    className={`bg-card absolute top-1 size-5 rounded-full shadow transition-all ${row.on ? 'left-6' : 'left-1'}`}
                  />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? 'Salvando…' : 'Salvar'}
        </Button>
        {saved && !dirty && <span className="text-primary text-sm font-medium">{saved}</span>}
        {error && (
          <span role="alert" className="text-destructive text-sm font-medium">
            {error}
          </span>
        )}
      </div>
    </div>
  )
}
