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
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1e1e1e] text-white">
          <Home className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] text-[#9a9a96]">Sua estadia em</p>
          <p className="truncate text-[14.5px] font-bold tracking-[-0.01em]">{pousada.name}</p>
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
        className="mt-3 grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-[28px] bg-[#1e1e1e] p-[18px] text-left text-white"
      >
        <div className="min-w-0">
          <p className="truncate text-[11.5px] text-[#a3a3a0]">{booking.roomName}</p>
          <p className="mt-0.5 text-[17px] font-bold tracking-[-0.02em]">
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
        <span className="bg-sunset grid size-[62px] place-items-center rounded-full">
          <KeyRound className="size-6 text-white" />
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
        <div className="mt-3 rounded-[24px] bg-white p-4">
          <p className="text-[11.5px] font-semibold text-[#9a9a96]">Recado da pousada</p>
          <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line text-[#1e1e1e]">
            {info.guestInfo}
          </p>
        </div>
      )}

      {info.dailyAgenda.length > 0 && (
        <>
          <SectionHead title="Hoje na pousada" aside={shortDate(stay.today)} />
          <ol className="rounded-[26px] bg-white px-4 py-1.5">
            {info.dailyAgenda.map((ev, i) => {
              const st = states[i]
              return (
                <li
                  key={`${ev.time}-${i}`}
                  className={cx(
                    'grid grid-cols-[40px_14px_1fr_auto] items-center gap-2 py-3',
                    i > 0 && 'border-t border-[#e6e6e2]',
                    st === 'done' && 'opacity-45',
                  )}
                >
                  <span className="text-[12.5px] font-extrabold">{hourLabel(ev.time)}</span>
                  <span
                    className={cx(
                      'size-2.5 rounded-full border-2',
                      st === 'done' && 'border-[#1e1e1e] bg-[#1e1e1e]',
                      st === 'now' && 'border-sunset bg-sunset shadow-[0_0_0_4px_#fff0e6]',
                      st === 'next' && 'border-[#d4d4cf] bg-[#ededea]',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold tracking-[-0.01em]">{ev.title}</p>
                    {ev.note && <p className="text-[11.5px] text-[#9a9a96]">{ev.note}</p>}
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
                role="button"
                tabIndex={0}
                onClick={() => ctx.openItem(item)}
                onKeyDown={(e) => e.key === 'Enter' && ctx.openItem(item)}
                className="relative min-h-[214px] w-[232px] shrink-0 cursor-pointer snap-start overflow-hidden rounded-[30px] bg-white p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Pill>{i === 0 ? 'Destaque' : 'No quarto'}</Pill>
                  <span className="text-[11.5px] text-[#9a9a96]">Na conta</span>
                </div>
                <p className="relative z-10 mt-3.5 w-[58%] text-[19px] leading-[1.12] font-extrabold tracking-[-0.03em]">
                  {item.name}
                </p>
                <div className="absolute top-12 -right-7">
                  <ItemVisual photoUrl={item.photoUrl} category={item.category} size={150} />
                </div>
                <p className="absolute bottom-4 left-4 text-[23px] font-extrabold tracking-[-0.03em]">
                  <span className="mr-0.5 align-top text-xs">R$</span>
                  {item.price.toFixed(2).replace('.', ',')}
                </p>
                {item.available && !ctx.orderBlockedReason ? (
                  <button
                    type="button"
                    aria-label={`Adicionar ${item.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      ctx.change(item, 1)
                      ctx.notify(`${item.name} na sacola`)
                    }}
                    className="bg-sunset absolute right-3.5 bottom-3.5 grid size-10 place-items-center rounded-full text-white"
                  >
                    <Plus className="size-4" strokeWidth={2.8} />
                  </button>
                ) : null}
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
                  className="w-[190px] shrink-0 snap-start rounded-[26px] bg-white p-2 pb-3.5"
                >
                  <div
                    className={cx(
                      'relative grid h-[104px] place-items-center rounded-[20px]',
                      i % 3 === 0 && 'bg-[#1e1e1e] text-white',
                      i % 3 === 1 && 'bg-sunset text-white',
                      i % 3 === 2 && 'bg-[#ededea] text-[#1e1e1e]',
                    )}
                  >
                    <Icon className="size-9" strokeWidth={1.6} />
                    {t.distance && (
                      <span className="absolute top-2.5 left-2.5">
                        <Pill tone="white">{t.distance}</Pill>
                      </span>
                    )}
                  </div>
                  <p className="mx-1.5 mt-3 text-[14.5px] leading-tight font-bold tracking-[-0.02em]">
                    {t.name}
                  </p>
                  {t.kind && <p className="mx-1.5 mt-0.5 text-[11.5px] text-[#9a9a96]">{t.kind}</p>}
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
          accent ? 'bg-sunset text-white' : 'bg-[#f4f4f2]',
        )}
      >
        {icon}
      </span>
      <span className="text-center leading-tight">{label}</span>
    </>
  )
  const cls =
    'flex flex-col items-center gap-2 rounded-[22px] bg-white px-1 py-3 text-[11.5px] font-bold text-[#1e1e1e]'
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
