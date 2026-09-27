'use client'

import { ArrowLeft, Check, ShoppingBag } from 'lucide-react'
import { formatBRL, formatDateTime } from '@/lib/format'
import { ORDER_STATUS_LABEL, type GuestOrder } from '@/features/pedidos/types'
import type { StayCtx } from './stay-context'
import { RoundButton, SectionHead, TwoTone, cx } from './stay-ui'

const STEP: Record<GuestOrder['status'], number> = {
  novo: 1,
  preparando: 2,
  entregue: 3,
  cancelado: 0,
}

function Steps({ status }: { status: GuestOrder['status'] }) {
  const s = STEP[status]
  return (
    <>
      <div className="mt-3.5 flex items-center" aria-hidden>
        {[1, 2, 3].map((i) => {
          const done = i < s || s === 3
          const now = i === s && s !== 3
          return (
            <div key={i} className={cx('flex items-center', i < 3 && 'flex-1')}>
              <span
                className={cx(
                  'grid size-[22px] shrink-0 place-items-center rounded-full',
                  done && 'bg-[#1e1e1e] text-white',
                  now && 'bg-sunset text-white shadow-[0_0_0_4px_#fff0e6]',
                  !done && !now && 'bg-[#ededea]',
                )}
              >
                {done && <Check className="size-3" strokeWidth={3.5} />}
              </span>
              {i < 3 && (
                <span
                  className={cx('mx-1 h-0.5 flex-1', i < s ? 'bg-[#1e1e1e]' : 'bg-[#ededea]')}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-[#9a9a96]">
        <span>Recebido</span>
        <span>Preparando</span>
        <span>Entregue</span>
      </div>
    </>
  )
}

export function StayAccount(ctx: StayCtx & { cancel: (o: GuestOrder) => void }) {
  const { consumption } = ctx.stay
  const [intPart, cents] = consumption.balance.toFixed(2).split('.')

  return (
    <>
      <div className="flex items-center gap-2.5">
        <RoundButton label="Voltar" onClick={() => ctx.go('inicio')}>
          <ArrowLeft className="size-[18px]" />
        </RoundButton>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] text-[#9a9a96]">Conta de consumo</p>
          <p className="truncate text-[14.5px] font-bold">Paga no check-out</p>
        </div>
      </div>
      <TwoTone strong="Sua" light="conta" className="mt-5 mb-4 px-0.5 text-[28px] leading-[1.1]" />

      <section className="rounded-[30px] bg-[#1e1e1e] p-5 text-white">
        <p className="text-xs text-[#a3a3a0]">A pagar no check-out</p>
        <p className="mt-1 text-[38px] leading-none font-extrabold tracking-[-0.04em]">
          <span className="mr-1 align-top text-base">R$</span>
          {Number(intPart).toLocaleString('pt-BR')},{cents}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          <div className="rounded-2xl bg-[#2b2b29] p-2.5">
            <p className="text-[10.5px] text-[#a3a3a0]">Consumido</p>
            <p className="mt-0.5 text-[13px] font-bold">{formatBRL(consumption.delivered)}</p>
          </div>
          <div className="rounded-2xl bg-[#2b2b29] p-2.5">
            <p className="text-[10.5px] text-[#a3a3a0]">Pago</p>
            <p className="mt-0.5 text-[13px] font-bold">{formatBRL(consumption.paid)}</p>
          </div>
          <div
            className={cx(
              'rounded-2xl p-2.5',
              consumption.balance > 0 ? 'bg-sunset' : 'bg-emerald-600',
            )}
          >
            <p className="text-[10.5px] text-white/80">Falta</p>
            <p className="mt-0.5 text-[13px] font-bold">
              {consumption.balance > 0 ? formatBRL(consumption.balance) : 'Nada'}
            </p>
          </div>
        </div>
        {consumption.open > 0 && (
          <p className="mt-3 text-[11.5px] text-[#a3a3a0]">
            + {formatBRL(consumption.open)} em pedidos ainda não entregues.
          </p>
        )}
      </section>

      <SectionHead title="Pedidos" aside="Pix, cartão ou dinheiro" />
      {ctx.orders.length === 0 ? (
        <p className="rounded-[24px] bg-white p-5 text-center text-[13px] text-[#9a9a96]">
          Nenhum pedido ainda.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {ctx.orders.map((o) => (
            <li key={o.id} className="rounded-[24px] bg-white p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f4f4f2]">
                  <ShoppingBag className="size-[17px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold">
                    {o.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}
                  </p>
                  <p className="text-[11.5px] text-[#9a9a96]">
                    {formatDateTime(o.createdAt)} · {ORDER_STATUS_LABEL[o.status]}
                    {o.source === 'equipe' ? ' · lançado pela equipe' : ''}
                  </p>
                </div>
                <span
                  className={cx(
                    'text-[14.5px] font-extrabold whitespace-nowrap',
                    o.status === 'cancelado' && 'text-[#9a9a96] line-through',
                  )}
                >
                  {formatBRL(o.total)}
                </span>
              </div>
              {o.status === 'cancelado' ? (
                <p className="mt-2 text-[12px] text-[#9a9a96]">
                  Pedido cancelado{o.cancelReason ? `: ${o.cancelReason}` : '.'}
                </p>
              ) : (
                <Steps status={o.status} />
              )}
              {o.status === 'novo' && o.source === 'hospede' && (
                <button
                  type="button"
                  onClick={() => ctx.cancel(o)}
                  className="mt-3 text-xs font-bold text-red-600"
                >
                  Cancelar pedido
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 px-2 text-center text-[11.5px] text-[#9a9a96]">
        O consumo é pago na recepção, no check-out. A diária é cobrada à parte.
      </p>
    </>
  )
}
