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
  sending: boolean
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
          <p className="text-muted-foreground text-[11.5px]">Recepção</p>
          <p className="truncate text-[14.5px] font-bold">{pousada.name}</p>
        </div>
      </div>
      <TwoTone
        strong="Precisa"
        light="de algo?"
        className="mt-5 mb-4 px-0.5 text-[28px] leading-[1.1]"
      />

      <div className="bg-card flex items-center gap-3 rounded-[28px] p-4">
        <span className="bg-ipe text-breu font-display grid size-12 shrink-0 place-items-center rounded-full text-lg font-medium">
          {pousada.name.trim().charAt(0).toUpperCase() || 'R'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">Fale com a recepção</p>
          <p className="text-muted-foreground text-xs">
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
              className="bg-neblina size-[42px]"
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
            <p className="bg-ipe/15 text-breu rounded-[20px] p-4 text-[13px] font-medium">
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
                    className="bg-card rounded-[24px] p-3.5 text-left disabled:opacity-50"
                  >
                    <span className="bg-neblina grid size-[38px] place-items-center rounded-full">
                      <Icon className="size-[17px]" />
                    </span>
                    <p className="mt-3 text-[13.5px] leading-tight font-bold">{s.name}</p>
                    <p className="text-muted-foreground text-[11px]">
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
            <p role="alert" className="text-destructive mt-2 text-sm font-medium">
              {ctx.orderError}
            </p>
          )}
        </>
      )}

      {(stay.canReview || stay.reviewed) && (
        <section className="bg-card mt-3 rounded-[28px] p-5 text-center">
          {stay.reviewed || review.sent ? (
            <>
              <Star className="fill-ipe text-ipe mx-auto size-8" />
              <p className="mt-2 font-bold">Obrigado pela avaliação!</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Ela aparece na página da pousada.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-bold">Como está a estadia?</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Sua nota ajuda outros viajantes.
              </p>
              <div className="mt-3 flex justify-center gap-0.5" role="group" aria-label="Nota">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={review.rating === n}
                    aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                    onClick={() => review.setRating(n)}
                    className="rounded-full p-1.5"
                  >
                    <Star
                      className={cx(
                        'size-8',
                        n <= review.rating ? 'fill-ipe text-ipe' : 'fill-pedra text-pedra',
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
                    className="bg-neblina focus-visible:ring-ipe/60 w-full resize-none rounded-[18px] px-3.5 py-3 text-[13px] outline-none focus-visible:ring-2"
                  />
                  {review.error && (
                    <p role="alert" className="text-destructive mt-1 text-sm font-medium">
                      {review.error}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={review.submit}
                    disabled={review.sending}
                    className="bg-breu text-neblina mt-2 w-full rounded-full py-3.5 text-sm font-bold disabled:opacity-60"
                  >
                    {review.sending ? 'Enviando…' : 'Enviar avaliação'}
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
