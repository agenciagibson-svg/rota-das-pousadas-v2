'use client'

import { ArrowLeft, MessageCircle, Phone, Star } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import type { StayCtx } from './stay-context'
import { RoundButton, SectionHead, TwoTone, cx, serviceIcon } from './stay-ui'

export type ReviewState = {
  rating: number
  setRating: (n: number) => void
  text: string
  setText: (t: string) => void
  error: string | null
  sent: boolean
  submit: () => void
}

export function StayReception(ctx: StayCtx & { review: ReviewState }) {
  const { stay, services, orderBlockedReason, review } = ctx
  const { booking, pousada } = stay
  const phone = pousada.phone.replace(/[^\d+]/g, '')
  const waText = `${ctx.wa}?text=${encodeURIComponent(
    `Olá! Sou hóspede da reserva ${booking.code} (${booking.roomName}).`,
  )}`

  return (
    <>
      <div className="flex items-center gap-2.5">
        <RoundButton label="Voltar" onClick={() => ctx.go('inicio')}>
          <ArrowLeft className="size-[18px]" />
        </RoundButton>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] text-[#9a9a96]">Recepção</p>
          <p className="truncate text-[14.5px] font-bold">{pousada.name}</p>
        </div>
      </div>
      <TwoTone
        strong="Precisa"
        light="de algo?"
        className="mt-5 mb-4 px-0.5 text-[28px] leading-[1.1]"
      />

      <div className="flex items-center gap-3 rounded-[28px] bg-white p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#fdba74,#f97316)] text-lg font-extrabold text-white">
          {pousada.name.trim().charAt(0).toUpperCase() || 'R'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">Fale com a recepção</p>
          <p className="text-xs text-[#9a9a96]">
            {ctx.wa || phone ? 'WhatsApp ou ligação' : 'Contato ainda não cadastrado'}
          </p>
        </div>
        <div className="flex gap-1.5">
          {ctx.wa && (
            <RoundButton label="Chamar no WhatsApp" href={waText} dark className="size-[42px]">
              <MessageCircle className="size-[18px]" />
            </RoundButton>
          )}
          {phone && (
            <RoundButton
              label="Ligar para a pousada"
              href={`tel:${phone}`}
              className="size-[42px] bg-[#f4f4f2]"
            >
              <Phone className="size-[17px]" />
            </RoundButton>
          )}
        </div>
      </div>

      {services.length > 0 && (
        <>
          <SectionHead title="Pedidos rápidos" aside="Um toque e a equipe recebe" />
          {orderBlockedReason ? (
            <p className="rounded-[20px] bg-[#fff0e6] p-4 text-[13px] font-medium text-[#9a3412]">
              {orderBlockedReason}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {services.map((s) => {
                const Icon = serviceIcon(s.name)
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={ctx.sending || !s.available}
                    onClick={async () => {
                      const ok = await ctx.sendNow([[s.id, 1]], '')
                      if (ok) ctx.notify(`${s.name}: pedido enviado`)
                    }}
                    className="rounded-[24px] bg-white p-3.5 text-left disabled:opacity-50"
                  >
                    <span className="grid size-[38px] place-items-center rounded-full bg-[#f4f4f2]">
                      <Icon className="size-[17px]" />
                    </span>
                    <p className="mt-3 text-[13.5px] leading-tight font-bold">{s.name}</p>
                    <p className="text-[11px] text-[#9a9a96]">
                      {!s.available
                        ? 'Indisponível'
                        : s.price === 0
                          ? 'Sem custo'
                          : `${formatBRL(s.price)} · na conta`}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
          {ctx.orderError && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-600">
              {ctx.orderError}
            </p>
          )}
        </>
      )}

      {(stay.canReview || stay.reviewed) && (
        <section className="mt-3 rounded-[28px] bg-white p-5 text-center">
          {stay.reviewed || review.sent ? (
            <>
              <Star className="mx-auto size-8 fill-amber-400 text-amber-400" />
              <p className="mt-2 font-bold">Obrigado pela avaliação!</p>
              <p className="mt-1 text-xs text-[#9a9a96]">Ela aparece na página da pousada.</p>
            </>
          ) : (
            <>
              <p className="text-base font-bold tracking-[-0.02em]">Como está a estadia?</p>
              <p className="mt-0.5 text-xs text-[#9a9a96]">Sua nota ajuda outros viajantes.</p>
              <div className="mt-3 flex justify-center gap-1.5" role="radiogroup" aria-label="Nota">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={review.rating === n}
                    aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                    onClick={() => review.setRating(n)}
                  >
                    <Star
                      className={cx(
                        'size-8',
                        n <= review.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-[#e4e4df] text-[#e4e4df]',
                      )}
                    />
                  </button>
                ))}
              </div>
              {review.rating > 0 && (
                <div className="mt-3 text-left">
                  <textarea
                    value={review.text}
                    onChange={(e) => review.setText(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Conte o que você mais gostou (opcional)"
                    aria-label="Comentário"
                    className="w-full resize-none rounded-[18px] bg-[#f4f4f2] px-3.5 py-3 text-[13px] outline-none"
                  />
                  {review.error && (
                    <p role="alert" className="mt-1 text-sm font-medium text-red-600">
                      {review.error}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={review.submit}
                    className="mt-2 w-full rounded-full bg-[#1e1e1e] py-3.5 text-sm font-bold text-white"
                  >
                    Enviar avaliação
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </>
  )
}
