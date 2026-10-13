'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Minus, Plus, Search, ShoppingBag } from 'lucide-react'
import { CATEGORY_LABEL, type InventoryCategory } from '@/features/estoque/labels'
import type { StayCtx } from './stay-context'
import { ItemVisual, RoundButton, SectionHead, TwoTone, cx } from './stay-ui'

function money(v: number) {
  return v.toFixed(2).replace('.', ',')
}

export function StayMenu(ctx: StayCtx & { openBag: () => void }) {
  const { products, cart, orderBlockedReason, stay } = ctx
  const categories = useMemo(() => {
    const seen: InventoryCategory[] = []
    for (const p of products) if (!seen.includes(p.category)) seen.push(p.category)
    return seen
  }, [products])
  const [cat, setCat] = useState<InventoryCategory | null>(categories[0] ?? null)
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const active = cat && categories.includes(cat) ? cat : (categories[0] ?? null)
  const visible = term
    ? products.filter(
        (p) => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term),
      )
    : products.filter((p) => p.category === active)

  return (
    <>
      <div className="flex items-center gap-2.5">
        <RoundButton label="Voltar" onClick={() => ctx.go('inicio')}>
          <ArrowLeft className="size-[18px]" />
        </RoundButton>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11.5px]">Entrega em</p>
          <p className="truncate text-[14.5px] font-bold">{stay.booking.roomName}</p>
        </div>
        <RoundButton label="Ver sacola" onClick={ctx.openBag} badge={ctx.cartCount || undefined}>
          <ShoppingBag className="size-[18px]" />
        </RoundButton>
      </div>
      <TwoTone
        strong="Cardápio"
        light="da pousada"
        className="mt-5 mb-4 px-0.5 text-[28px] leading-[1.1]"
      />

      {orderBlockedReason && (
        <p className="bg-ipe/15 text-breu mb-3 rounded-[20px] p-4 text-[13px] font-medium">
          {orderBlockedReason}
        </p>
      )}

      {products.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-[24px] p-5 text-center text-[13px]">
          A pousada ainda não cadastrou itens no app. Fale com a recepção.
        </p>
      ) : (
        <>
          <label className="bg-card flex h-12 items-center gap-2.5 rounded-full px-4">
            <Search className="size-[17px]" strokeWidth={2.4} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar no cardápio"
              aria-label="Buscar no cardápio"
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
            />
          </label>

          {!term && categories.length > 1 && (
            <div className="-mx-[18px] mt-3.5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-[18px] pb-0.5">
              {categories.map((c) => {
                const first = products.find((p) => p.category === c)!
                const on = c === active
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCat(c)}
                    className={cx(
                      'flex h-[46px] shrink-0 items-center gap-2 rounded-full py-1 pr-4 pl-1 text-[13px] font-semibold',
                      on ? 'bg-ipe text-breu' : 'bg-card text-breu',
                    )}
                  >
                    <ItemVisual photoUrl={first.photoUrl} category={c} size={38} />
                    {CATEGORY_LABEL[c] ?? c}
                  </button>
                )
              })}
            </div>
          )}

          <SectionHead
            title={
              term
                ? `Resultados para “${q.trim()}”`
                : active
                  ? (CATEGORY_LABEL[active] ?? active)
                  : ''
            }
            aside={stay.info.ordersHours || undefined}
          />

          {visible.length === 0 ? (
            <p className="bg-card text-muted-foreground rounded-[24px] p-5 text-center text-[13px]">
              Nada encontrado.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {visible.map((item) => {
                const qty = cart[item.id] ?? 0
                const canAdd = item.available && !orderBlockedReason
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => ctx.openItem(item)}
                    onKeyDown={(e) => e.key === 'Enter' && ctx.openItem(item)}
                    className={cx(
                      'bg-card flex cursor-pointer flex-col rounded-[26px] px-3 pt-3 pb-3.5 text-center',
                      !item.available && 'opacity-55',
                    )}
                  >
                    <div className="grid h-[112px] place-items-center">
                      <ItemVisual
                        photoUrl={item.photoUrl}
                        category={item.category}
                        size={104}
                        alt={item.name}
                      />
                    </div>
                    <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-tight font-bold">
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[11px]">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-1 pt-3 text-left">
                      <span className="font-display text-[18px] font-medium">
                        {item.price === 0 ? (
                          <span className="text-sm">Cortesia</span>
                        ) : (
                          <>
                            <span className="align-top text-[11px]">R$</span>
                            {money(item.price)}
                          </>
                        )}
                      </span>
                      {!item.available ? (
                        <span className="text-muted-foreground text-[11px] font-bold">
                          Esgotado
                        </span>
                      ) : qty > 0 ? (
                        <div
                          className="bg-breu text-neblina flex items-center gap-1 rounded-full p-[3px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            aria-label={`Menos ${item.name}`}
                            onClick={() => ctx.change(item, -1)}
                            className="grid size-7 place-items-center rounded-full"
                          >
                            <Minus className="size-3.5" strokeWidth={2.8} />
                          </button>
                          <span className="min-w-3.5 text-center text-[13px] font-bold">{qty}</span>
                          <button
                            type="button"
                            aria-label={`Mais ${item.name}`}
                            disabled={qty >= item.maxQuantity}
                            onClick={() => ctx.change(item, 1)}
                            className="bg-ipe text-breu grid size-7 place-items-center rounded-full disabled:opacity-40"
                          >
                            <Plus className="size-3.5" strokeWidth={2.8} />
                          </button>
                        </div>
                      ) : canAdd ? (
                        <button
                          type="button"
                          aria-label={`Adicionar ${item.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            ctx.change(item, 1)
                          }}
                          className="bg-ipe text-breu grid size-[34px] place-items-center rounded-full"
                        >
                          <Plus className="size-4" strokeWidth={2.8} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}
