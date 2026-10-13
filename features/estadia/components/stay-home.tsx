'use client'

import { Clock, Home, KeyRound, MapPin, MessageCircle, Plus, ShoppingBag, Wifi } from 'lucide-react'
import { agendaState } from '../info'
import { daysBetween, dayMonth, hourLabel, shortDate } from '../dates'
import type { StayCtx } from './stay-context'
import { InstallPrompt } from './install-prompt'
import { ItemVisual, Pill, RoundButton, SectionHead, TwoTone, cx, tipIcon } from './stay-ui'

export function stayStatusLabel(ctx: StayCtx): string {
  const { booking } = ctx.stay
  const today = ctx.stay.today
  if (booking.status === 'checked_out' || booking.checkout < today) return 'Estadia encerrada'
  if (booking.status === 'checked_in') return 'Hospedado'
  if (booking.checkin > today) {
    const d = daysBetween(today, booking.checkin)
    return d === 1 ? 'Chega amanhã' : `Faltam ${d} dias`
  }
  return 'Check-in hoje'
}

export function StayHome(ctx: StayCtx) {
  const { stay, products, now } = ctx
  const { booking, pousada, info } = stay
  const highlights = products.slice(0, 8)
  const states = now ? agendaState(info.dailyAgenda, now) : info.dailyAgenda.map(() => 'next')
  const isCheckoutDay = stay.today === booking.checkout

  return (
    <>
      <div className="flex items-center gap-2.5">
        <span className="bg-breu text-neblina grid size-11 shrink-0 place-items-center rounded-full">
          <Home className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11.5px]">Sua estadia em</p>
          <p className="truncate text-[14.5px] font-bold">{pousada.name}</p>
        </div>
        <RoundButton label="Falar com a recepção" onClick={() => ctx.go('recepcao')}>
          <MessageCircle className="size-[18px]" />
        </RoundButton>
      </div>

      <TwoTone
        strong="Olá,"
        light={booking.guestName || 'hóspede'}
        className="mt-5 mb-4 px-0.5 text-[28px] leading-[1.1]"
      />

      <InstallPrompt />

      <button
        type="button"
        onClick={() => ctx.go('estadia')}
        className="bg-breu text-neblina mt-3 grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-[28px] p-[18px] text-left"
      >
        <div className="min-w-0">
          <p className="text-liquen truncate text-[11.5px]">{booking.roomName}</p>
          <p className="font-display mt-0.5 text-[17px] font-medium">
            {dayMonth(booking.checkin)} → {dayMonth(booking.checkout)}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill tone="white">{stayStatusLabel(ctx)}</Pill>
            <Pill tone="gray">
              {isCheckoutDay
                ? 'Check-out hoje'
                : `Check-out ${shortDate(booking.checkout).split(',')[0].toLowerCase()}`}
              , {hourLabel(pousada.checkoutTime)}
            </Pill>
          </div>
        </div>
        <span className="bg-ipe grid size-[62px] place-items-center rounded-full">
          <KeyRound className="text-breu size-6" />
        </span>
      </button>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <QuickTile
          label="Wi-Fi"
          accent
          icon={<Wifi className="size-5" />}
          onClick={() =>
            info.wifiPassword
              ? ctx.copy(info.wifiPassword, 'Senha do Wi-Fi copiada')
              : ctx.go('estadia', 'info')
          }
        />
        <QuickTile
          label="Horários"
          icon={<Clock className="size-5" />}
          onClick={() => ctx.go('estadia', 'info')}
        />
        <QuickTile label="Como chegar" icon={<MapPin className="size-5" />} href={ctx.mapsUrl} />
        {products.length > 0 ? (
          <QuickTile
            label="Pedir"
            icon={<ShoppingBag className="size-5" />}
            onClick={() => ctx.go('pedir')}
          />
        ) : (
          <QuickTile
            label="Recepção"
            icon={<MessageCircle className="size-5" />}
            onClick={() => ctx.go('recepcao')}
          />
        )}
      </div>

      {info.guestInfo && (
        <div className="bg-card mt-3 rounded-[24px] p-4">
          <p className="text-muted-foreground text-[11.5px] font-semibold">Recado da pousada</p>
          <p className="text-breu mt-1 text-[13.5px] leading-relaxed whitespace-pre-line">
            {info.guestInfo}
          </p>
        </div>
      )}

      {info.dailyAgenda.length > 0 && (
        <>
          <SectionHead title="Hoje na pousada" aside={shortDate(stay.today)} />
          <ol className="bg-card rounded-[26px] px-4 py-1.5">
            {info.dailyAgenda.map((ev, i) => {
              const st = states[i]
              return (
                <li
                  key={`${ev.time}-${i}`}
                  className={cx(
                    'grid grid-cols-[40px_14px_1fr_auto] items-center gap-2 py-3',
                    i > 0 && 'border-border border-t',
                    st === 'done' && 'opacity-45',
                  )}
                >
                  <span className="text-[12.5px] font-bold">{hourLabel(ev.time)}</span>
                  <span
                    className={cx(
                      'size-2.5 rounded-full border-2',
                      st === 'done' && 'border-breu bg-breu',
                      st === 'now' && 'border-ipe bg-ipe ring-ipe/30 ring-4',
                      st === 'next' && 'border-pedra bg-secondary',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold">{ev.title}</p>
                    {ev.note && <p className="text-muted-foreground text-[11.5px]">{ev.note}</p>}
                  </div>
                  {st === 'now' && <Pill>Agora</Pill>}
                </li>
              )
            })}
          </ol>
        </>
      )}

      {highlights.length > 0 && (
        <>
          <SectionHead title="Peça no quarto" action="Cardápio" onAction={() => ctx.go('pedir')} />
          <div className="-mx-[18px] flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-[18px] pb-1">
            {highlights.map((item, i) => (
              <div
                key={item.id}
                className="bg-card relative min-h-[214px] w-[232px] shrink-0 snap-start overflow-hidden rounded-[30px] p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Pill>{i === 0 ? 'Destaque' : 'No quarto'}</Pill>
                  <span className="text-muted-foreground text-[11.5px]">Na conta</span>
                </div>
                <p className="font-display relative z-10 mt-3.5 w-[58%] text-[19px] leading-[1.12] font-medium">
                  {item.name}
                </p>
                <div className="absolute top-12 -right-7">
                  <ItemVisual photoUrl={item.photoUrl} category={item.category} size={150} />
                </div>
                <p className="font-display absolute bottom-4 left-4 text-[23px] font-medium">
                  <span className="mr-0.5 align-top text-xs">R$</span>
                  {item.price.toFixed(2).replace('.', ',')}
                </p>
                {item.available && !ctx.orderBlockedReason ? (
                  <button
                    type="button"
                    aria-label={`Adicionar ${item.name}`}
                    onClick={() => {
                      ctx.change(item, 1)
                      ctx.notify(`${item.name} na sacola`)
                    }}
                    className="bg-ipe text-breu absolute right-3.5 bottom-3.5 z-20 grid size-10 place-items-center rounded-full"
                  >
                    <Plus className="size-4" strokeWidth={2.8} />
                  </button>
                ) : null}
                {/* Card inteiro abre o detalhe (botão de verdade, sem aninhar o "+"). */}
                <button
                  type="button"
                  aria-label={item.name}
                  onClick={() => ctx.openItem(item)}
                  className="focus-visible:ring-ipe absolute inset-0 z-10 rounded-[30px] outline-none focus-visible:ring-2 focus-visible:ring-inset"
                />
              </div>
            ))}
          </div>
        </>
      )}

      {info.localTips.length > 0 && (
        <>
          <SectionHead
            title="Explore a região"
            action="Ver dicas"
            onAction={() => ctx.go('estadia', 'regiao')}
          />
          <div className="-mx-[18px] flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto px-[18px] pb-1">
            {info.localTips.map((t, i) => {
              const Icon = tipIcon(t.kind)
              return (
                <a
                  key={`${t.name}-${i}`}
                  href={tipMapsUrl(t.name, pousada.city, pousada.state)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-card w-[190px] shrink-0 snap-start rounded-[26px] p-2 pb-3.5"
                >
                  <div
                    className={cx(
                      'relative grid h-[104px] place-items-center rounded-[20px]',
                      i % 3 === 0 && 'bg-breu text-neblina',
                      i % 3 === 1 && 'bg-ipe text-breu',
                      i % 3 === 2 && 'bg-secondary text-breu',
                    )}
                  >
                    <Icon className="size-9" strokeWidth={1.6} />
                    {t.distance && (
                      <span className="absolute top-2.5 left-2.5">
                        <Pill tone="white">{t.distance}</Pill>
                      </span>
                    )}
                  </div>
                  <p className="mx-1.5 mt-3 text-[14.5px] leading-tight font-bold">{t.name}</p>
                  {t.kind && (
                    <p className="text-muted-foreground mx-1.5 mt-0.5 text-[11.5px]">{t.kind}</p>
                  )}
                </a>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

export function tipMapsUrl(name: string, city: string, state: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [name, city, state].filter(Boolean).join(', '),
  )}`
}

function QuickTile({
  label,
  icon,
  onClick,
  href,
  accent,
}: {
  label: string
  icon: React.ReactNode
  onClick?: () => void
  href?: string
  accent?: boolean
}) {
  const body = (
    <>
      <span
        className={cx(
          'grid size-[42px] place-items-center rounded-full',
          accent ? 'bg-ipe text-breu' : 'bg-neblina',
        )}
      >
        {icon}
      </span>
      <span className="text-center leading-tight">{label}</span>
    </>
  )
  const cls =
    'flex flex-col items-center gap-2 rounded-[22px] bg-card px-1 py-3 text-[11.5px] font-bold text-breu'
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  )
}
