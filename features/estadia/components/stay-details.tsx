'use client'

import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Car,
  Check,
  ChevronRight,
  Clock,
  Coffee,
  ShieldCheck,
  Wifi,
} from 'lucide-react'
import { formatBRL, plural } from '@/lib/format'
import { DEFAULT_EMERGENCY } from '../info'
import { daysBetween, hourLabel, shortDate } from '../dates'
import type { StayCtx } from './stay-context'
import { tipMapsUrl } from './stay-home'
import { Pill, RoundButton, SectionHead, TwoTone, amenityIcon, cx, tipIcon } from './stay-ui'

function Row({
  icon,
  label,
  value,
  action,
  multiline,
}: {
  icon: React.ReactNode
  label: string
  value: string
  action?: React.ReactNode
  multiline?: boolean
}) {
  return (
    <li className="flex items-center gap-3 py-3 [&+&]:border-t [&+&]:border-[#e6e6e2]">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f4f4f2]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] text-[#9a9a96]">{label}</p>
        <p
          className={cx(
            'mt-px text-[13.5px] font-bold tracking-[-0.01em]',
            multiline && 'font-semibold whitespace-pre-line',
          )}
        >
          {value}
        </p>
      </div>
      {action}
    </li>
  )
}

export function StayDetails(ctx: StayCtx) {
  const { stay } = ctx
  const { booking, pousada, info } = stay
  const nights = Math.max(1, daysBetween(booking.checkin, booking.checkout))
  const guests = [
    plural(booking.adults, 'adulto', 'adultos'),
    booking.children > 0 ? plural(booking.children, 'criança', 'crianças') : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const address = [pousada.address, pousada.city && `${pousada.city}/${pousada.state}`, pousada.cep]
    .filter(Boolean)
    .join(' · ')
  const emergency = info.emergency.length > 0 ? info.emergency : DEFAULT_EMERGENCY
  const inHouse =
    (booking.status === 'checked_in' || booking.status === 'confirmed') &&
    stay.today >= booking.checkin &&
    stay.today <= booking.checkout

  return (
    <>
      <div className="flex items-center gap-2.5">
        <RoundButton label="Voltar" onClick={() => ctx.go('inicio')}>
          <ArrowLeft className="size-[18px]" />
        </RoundButton>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] text-[#9a9a96]">Reserva {booking.code}</p>
          <p className="truncate text-[14.5px] font-bold">Sua hospedagem</p>
        </div>
      </div>
      <TwoTone
        strong="Sua"
        light="estadia"
        className="mt-5 mb-4 px-0.5 text-[28px] leading-[1.1]"
      />

      <section className="rounded-[30px] bg-[#1e1e1e] p-4 text-white">
        <div className="flex items-center gap-3.5">
          <span className="bg-sunset grid size-[76px] shrink-0 place-items-center rounded-[22px]">
            <BedDouble className="size-9" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-[#a3a3a0]">Acomodação</p>
            <p className="text-[17px] leading-tight font-bold tracking-[-0.02em]">
              {booking.roomName}
            </p>
            <div className="mt-2">
              <Pill tone="gray">{guests}</Pill>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[20px] bg-[#2b2b29] px-3.5 py-3">
          <div>
            <p className="text-[11px] text-[#a3a3a0]">Check-in</p>
            <p className="mt-0.5 text-sm font-bold">{shortDate(booking.checkin)}</p>
            <p className="text-[11px] text-[#a3a3a0]">
              a partir das {hourLabel(pousada.checkinTime)}
            </p>
          </div>
          <Pill tone="white">{plural(nights, 'noite', 'noites')}</Pill>
          <div className="text-right">
            <p className="text-[11px] text-[#a3a3a0]">Check-out</p>
            <p className="mt-0.5 text-sm font-bold">{shortDate(booking.checkout)}</p>
            <p className="text-[11px] text-[#a3a3a0]">até {hourLabel(pousada.checkoutTime)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[12.5px]">
          {booking.balanceDue > 0 ? (
            <span className="text-amber-300">
              Falta pagar {formatBRL(booking.balanceDue)} das diárias
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-300">
              <Check className="size-3.5" strokeWidth={3} /> Diárias pagas ·{' '}
              {formatBRL(booking.total)}
            </span>
          )}
          <button
            type="button"
            onClick={() => ctx.go('conta')}
            className="bg-sunset shrink-0 rounded-full px-3.5 py-2 text-xs font-bold text-white"
          >
            Consumo
          </button>
        </div>
      </section>

      {booking.roomAmenities.length > 0 && (
        <>
          <SectionHead title="Seu quarto" />
          <div className="flex flex-wrap gap-2">
            {booking.roomAmenities.map((a) => {
              const Icon = amenityIcon(a)
              return (
                <span
                  key={a}
                  className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[12.5px] font-semibold"
                >
                  <Icon className="size-4" /> {a}
                </span>
              )
            })}
          </div>
        </>
      )}

      <div id="info" className="scroll-mt-4">
        <SectionHead title="Informações" />
      </div>
      <ul className="rounded-[26px] bg-white px-3.5">
        {(info.wifiName || info.wifiPassword) && (
          <Row
            icon={<Wifi className="size-[17px]" />}
            label={info.wifiName ? `Wi-Fi · ${info.wifiName}` : 'Wi-Fi'}
            value={info.wifiPassword || 'A senha aparece no dia do check-in'}
            action={
              info.wifiPassword ? (
                <button
                  type="button"
                  onClick={() => ctx.copy(info.wifiPassword, 'Senha do Wi-Fi copiada')}
                  className="shrink-0 rounded-full bg-[#1e1e1e] px-3 py-2 text-xs font-bold text-white"
                >
                  Copiar
                </button>
              ) : undefined
            }
          />
        )}
        <Row
          icon={<Clock className="size-[17px]" />}
          label="Check-in e check-out"
          value={`Entrada a partir das ${hourLabel(pousada.checkinTime)} · saída até ${hourLabel(pousada.checkoutTime)}`}
        />
        {info.breakfastInfo && (
          <Row
            icon={<Coffee className="size-[17px]" />}
            label="Café da manhã"
            value={info.breakfastInfo}
          />
        )}
        {info.facilities.map((f, i) => (
          <Row
            key={`${f.name}-${i}`}
            icon={<Clock className="size-[17px]" />}
            label={f.name}
            value={f.hours || 'Disponível'}
          />
        ))}
        {info.parkingInfo && (
          <Row
            icon={<Car className="size-[17px]" />}
            label="Estacionamento"
            value={info.parkingInfo}
          />
        )}
        {pousada.houseRules && (
          <Row
            icon={<ShieldCheck className="size-[17px]" />}
            label="Regras da casa"
            value={pousada.houseRules}
            multiline
          />
        )}
      </ul>

      <div id="chegar" className="scroll-mt-4">
        <SectionHead title="Como chegar" />
      </div>
      <div className="overflow-hidden rounded-[28px] bg-white p-2">
        <div
          aria-hidden
          className="relative h-[124px] rounded-[22px] bg-[#e9eee4] bg-[linear-gradient(35deg,transparent_46%,#fff_46%_50%,transparent_50%),linear-gradient(-20deg,transparent_60%,#fff_60%_63%,transparent_63%),radial-gradient(circle_at_20%_70%,#cfe3c8_0_18%,transparent_19%),radial-gradient(circle_at_80%_25%,#cfe3c8_0_14%,transparent_15%)]"
        >
          <span className="bg-sunset absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white shadow-[0_0_0_8px_rgba(249,115,22,0.18)]">
            <BedDouble className="size-[18px]" />
          </span>
        </div>
        <div className="px-2 pt-3 pb-1">
          <p className="text-sm font-bold">{pousada.name}</p>
          <p className="text-[11.5px] text-[#9a9a96]">
            {address || `${pousada.city}/${pousada.state}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-2">
          <a
            href={ctx.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#1e1e1e] py-3 text-center text-[12.5px] font-bold text-white"
          >
            Google Maps
          </a>
          <a
            href={ctx.wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#f4f4f2] py-3 text-center text-[12.5px] font-bold"
          >
            Waze
          </a>
        </div>
      </div>

      {info.localTips.length > 0 && (
        <>
          <div id="regiao" className="scroll-mt-4">
            <SectionHead title="Dicas da região" />
          </div>
          <ul className="rounded-[26px] bg-white px-3.5">
            {info.localTips.map((t, i) => {
              const Icon = tipIcon(t.kind)
              return (
                <li key={`${t.name}-${i}`} className="[&+&]:border-t [&+&]:border-[#e6e6e2]">
                  <a
                    href={tipMapsUrl(t.name, pousada.city, pousada.state)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 py-3"
                  >
                    <span className="text-sunset grid size-10 shrink-0 place-items-center rounded-full bg-[#fff0e6]">
                      <Icon className="size-[17px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] text-[#9a9a96]">
                        {[t.kind, t.distance].filter(Boolean).join(' · ')}
                      </p>
                      <p className="text-[13.5px] font-bold">{t.name}</p>
                    </div>
                    <span className="grid size-7 place-items-center rounded-full bg-[#f4f4f2]">
                      <ChevronRight className="size-3.5" />
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <SectionHead title="Emergência" />
      <div className="grid grid-cols-3 gap-2">
        {emergency.map((e, i) => (
          <a
            key={`${e.label}-${i}`}
            href={`tel:${e.phone.replace(/[^\d+]/g, '')}`}
            className="rounded-[22px] bg-white px-2 py-3.5 text-center"
          >
            <p className="truncate text-[17px] font-extrabold tracking-[-0.02em]">{e.phone}</p>
            <p className="truncate text-[11px] text-[#9a9a96]">{e.label}</p>
          </a>
        ))}
      </div>

      {pousada.cancellationPolicy && (
        <details className="mt-3 rounded-[22px] bg-white px-4 py-3 text-[13px]">
          <summary className="cursor-pointer font-bold">Política de cancelamento</summary>
          <p className="mt-2 whitespace-pre-line text-[#4a4a48]">{pousada.cancellationPolicy}</p>
        </details>
      )}

      {inHouse && ctx.wa && (
        <a
          href={`${ctx.wa}?text=${encodeURIComponent(
            `Olá! Quero fazer o check-out expresso da reserva ${booking.code} (${booking.roomName}).`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex h-14 w-full items-center justify-between rounded-full bg-[#1e1e1e] pr-2 pl-5 text-[14.5px] font-bold text-white"
        >
          Fazer check-out expresso
          <span className="bg-sunset grid size-[42px] place-items-center rounded-full">
            <ArrowRight className="size-4" />
          </span>
        </a>
      )}
    </>
  )
}
