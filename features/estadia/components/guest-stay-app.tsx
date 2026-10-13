'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Home,
  KeyRound,
  MessageCircle,
  Minus,
  Plus,
  ReceiptText,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import { formatBRL, formatISODate, whatsappLink } from '@/lib/format'
import type { GuestOrder } from '@/features/pedidos/types'
import { cancelGuestOrderAction, placeGuestOrderAction, submitStayReviewAction } from '../actions'
import { nowHHMM } from '../dates'
import type { GuestStay, StayMenuItem } from '../types'
import type { StayCtx, StayTab } from './stay-context'
import { StayAccount } from './stay-account'
import { StayDetails } from './stay-details'
import { StayHome } from './stay-home'
import { StayMenu } from './stay-menu'
import { StayReception } from './stay-reception'
import { APP_BG, ItemVisual, RoundButton, Sheet, cx } from './stay-ui'

const REFRESH_MS = 20_000

const TABS: { id: StayTab; label: string; icon: typeof Home }[] = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'estadia', label: 'Estadia', icon: KeyRound },
  { id: 'pedir', label: 'Pedir', icon: ShoppingBag },
  { id: 'conta', label: 'Conta', icon: ReceiptText },
  { id: 'recepcao', label: 'Recepção', icon: MessageCircle },
]

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const a = document.createElement('textarea')
    a.value = text
    document.body.appendChild(a)
    a.select()
    document.execCommand('copy')
    a.remove()
  }
}

export function GuestStayApp({ stay, orders }: { stay: GuestStay; orders: GuestOrder[] }) {
  const router = useRouter()
  const { booking, pousada } = stay
  const [tab, setTab] = useState<StayTab>('inicio')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState('')
  const [detail, setDetail] = useState<StayMenuItem | null>(null)
  const [detailQty, setDetailQty] = useState(1)
  const [bagOpen, setBagOpen] = useState(false)
  const closeDetail = useCallback(() => setDetail(null), [])
  const closeBag = useCallback(() => setBagOpen(false), [])
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSent, setReviewSent] = useState(false)
  const [reviewSending, setReviewSending] = useState(false)
  const lastStatus = useRef<Map<string, string> | null>(null)

  const services = useMemo(() => stay.menu.filter((m) => m.category === 'servicos'), [stay.menu])
  const products = useMemo(() => stay.menu.filter((m) => m.category !== 'servicos'), [stay.menu])
  const openOrders = orders.filter((o) => o.status === 'novo' || o.status === 'preparando')

  const cartLines = Object.entries(cart).filter(([, q]) => q > 0)
  const cartCount = cartLines.reduce((s, [, q]) => s + q, 0)
  const cartTotal = cartLines.reduce(
    (s, [id, q]) => s + (stay.menu.find((m) => m.id === id)?.price ?? 0) * q,
    0,
  )

  const wa = whatsappLink(pousada.whatsapp || pousada.phone)
  const place = [pousada.name, pousada.address, pousada.city, pousada.state]
    .filter(Boolean)
    .join(', ')
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(place)}&navigate=yes`

  const orderBlockedReason = !stay.ordersEnabled
    ? 'A pousada não está recebendo pedidos pelo app agora. Fale com a recepção.'
    : booking.status === 'checked_out' || booking.checkout < stay.today
      ? 'Sua estadia terminou. Obrigado pela visita!'
      : booking.checkin > stay.today
        ? `Os pedidos ficam liberados a partir do check-in, em ${formatISODate(booking.checkin)}.`
        : !stay.canOrder
          ? 'Pedidos indisponíveis para esta reserva. Fale com a recepção.'
          : null

  // Hora local da pousada (só no navegador, para a agenda do dia).
  useEffect(() => {
    const tick = () => setNow(nowHHMM(pousada.timezone))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [pousada.timezone])

  // Atualiza os pedidos a cada 20 s e avisa quando o status mudar.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [router])

  useEffect(() => {
    const current = new Map(orders.map((o) => [o.id, o.status]))
    if (lastStatus.current) {
      for (const o of orders) {
        const before = lastStatus.current.get(o.id)
        if (before && before !== o.status) {
          setToast(
            o.status === 'entregue'
              ? 'Seu pedido foi entregue. Bom proveito!'
              : o.status === 'preparando'
                ? 'A pousada começou a preparar seu pedido.'
                : o.status === 'cancelado'
                  ? `Pedido cancelado pela pousada${o.cancelReason ? `: ${o.cancelReason}` : '.'}`
                  : null,
          )
        }
      }
    }
    lastStatus.current = current
  }, [orders])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // A aba aberta fica na URL (?aba=): voltar e recarregar mantêm onde a pessoa estava.
  useEffect(() => {
    const aba = new URLSearchParams(window.location.search).get('aba')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê a URL só depois de hidratar
    if (aba && TABS.some((t) => t.id === aba)) setTab(aba as StayTab)
  }, [])

  const go = useCallback((next: StayTab, anchor?: string) => {
    setDetail(null)
    setBagOpen(false)
    setTab(next)
    const url = new URL(window.location.href)
    if (next === 'inicio') url.searchParams.delete('aba')
    else url.searchParams.set('aba', next)
    window.history.replaceState(window.history.state, '', url)
    requestAnimationFrame(() => {
      const el = anchor ? document.getElementById(anchor) : null
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      else window.scrollTo({ top: 0 })
    })
  }, [])

  function change(item: StayMenuItem, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, Math.min(item.maxQuantity, (prev[item.id] ?? 0) + delta))
      return { ...prev, [item.id]: next }
    })
  }

  async function sendNow(lines: [string, number][], orderNote: string) {
    setOrderError(null)
    setSending(true)
    try {
      const res = await placeGuestOrderAction({
        bookingId: booking.id,
        items: lines.map(([itemId, quantity]) => ({ itemId, quantity })),
        note: orderNote,
      })
      if (!res.ok) {
        setOrderError(res.error)
        return false
      }
      router.refresh()
      return true
    } catch {
      setOrderError('Sem conexão. Tente de novo.')
      return false
    } finally {
      setSending(false)
    }
  }

  async function sendCart() {
    const ok = await sendNow(cartLines, note)
    if (ok) {
      setCart({})
      setNote('')
      setToast('Pedido enviado! A pousada já recebeu.')
      go('conta')
    }
  }

  async function cancel(order: GuestOrder) {
    const res = await cancelGuestOrderAction({ orderId: order.id })
    if (!res.ok) setToast(res.error)
    else {
      setToast('Pedido cancelado.')
      router.refresh()
    }
  }

  async function submitReview() {
    setReviewError(null)
    if (rating < 1) {
      setReviewError('Escolha de 1 a 5 estrelas.')
      return
    }
    setReviewSending(true)
    const res = await submitStayReviewAction({ bookingId: booking.id, rating, text: reviewText })
    setReviewSending(false)
    if (!res.ok) setReviewError(res.error)
    else {
      setReviewSent(true)
      router.refresh()
    }
  }

  const ctx: StayCtx = {
    stay,
    orders,
    products,
    services,
    cart,
    cartCount,
    orderBlockedReason,
    now,
    wa,
    mapsUrl,
    wazeUrl,
    go,
    openItem: (item) => {
      setDetail(item)
      setDetailQty(1)
    },
    change,
    notify: setToast,
    copy: (text, msg) => {
      void copyToClipboard(text)
      setToast(msg)
    },
    sendNow,
    sending,
    orderError,
  }

  const showBagBar = cartCount > 0 && (tab === 'pedir' || tab === 'inicio') && !detail && !bagOpen
  const detailRoom = detail ? detail.maxQuantity - (cart[detail.id] ?? 0) : 0
  const detailCanAdd = !!detail && detail.available && !orderBlockedReason && detailRoom > 0

  return (
    <div className={cx('text-breu min-h-dvh', APP_BG)}>
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto max-w-lg px-[18px] pt-[max(16px,env(safe-area-inset-top))] pb-44"
      >
        {tab === 'inicio' && <StayHome {...ctx} />}
        {tab === 'estadia' && <StayDetails {...ctx} />}
        {tab === 'pedir' && <StayMenu {...ctx} openBag={() => setBagOpen(true)} />}
        {tab === 'conta' && <StayAccount {...ctx} cancel={(o) => void cancel(o)} />}
        {tab === 'recepcao' && (
          <StayReception
            {...ctx}
            review={{
              rating,
              setRating,
              text: reviewText,
              setText: setReviewText,
              error: reviewError,
              sent: reviewSent,
              sending: reviewSending,
              submit: () => void submitReview(),
            }}
          />
        )}
        <p className="text-muted-foreground pt-8 text-center text-xs">
          <Link href="/minhas-reservas" className="underline">
            Minhas reservas
          </Link>{' '}
          · Rota das Pousadas
        </p>
      </main>

      {/* Detalhe do item */}
      <Sheet
        open={!!detail}
        label={detail ? detail.name : 'Item'}
        onClose={closeDetail}
        footer={
          detail && detailCanAdd ? (
            <div className="from-neblina absolute inset-x-0 bottom-0 bg-gradient-to-t from-70% to-transparent px-[18px] pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
              <div className="mx-auto flex max-w-lg items-center gap-2.5">
                <div className="bg-card flex items-center gap-1 rounded-full p-[5px]">
                  <button
                    type="button"
                    aria-label="Menos"
                    onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                    className="bg-neblina grid size-[38px] place-items-center rounded-full"
                  >
                    <Minus className="size-3.5" strokeWidth={2.8} />
                  </button>
                  <span className="min-w-6 text-center font-bold">{detailQty}</span>
                  <button
                    type="button"
                    aria-label="Mais"
                    onClick={() => setDetailQty((q) => Math.min(detailRoom, q + 1))}
                    className="bg-neblina grid size-[38px] place-items-center rounded-full"
                  >
                    <Plus className="size-3.5" strokeWidth={2.8} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    change(detail, detailQty)
                    setToast(`${detailQty}× ${detail.name} na sacola`)
                    setDetail(null)
                  }}
                  className="bg-breu text-neblina flex h-[50px] flex-1 items-center justify-between rounded-full pr-2 pl-5 text-[14.5px] font-bold"
                >
                  Adicionar
                  <span className="bg-ipe text-breu rounded-full px-3.5 py-2 text-[13.5px]">
                    {formatBRL(detail.price * detailQty)}
                  </span>
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {detail && (
          <>
            <RoundButton label="Voltar" onClick={() => setDetail(null)}>
              <ArrowLeft className="size-[18px]" />
            </RoundButton>
            <div className="mx-auto mt-2 grid h-[270px] w-[270px] place-items-center">
              <ItemVisual
                photoUrl={detail.photoUrl}
                category={detail.category}
                size={250}
                alt={detail.name}
              />
            </div>
            <div className="bg-card -mt-2 rounded-[30px] p-[18px]">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-[22px] leading-tight font-medium">
                  {detail.name}
                </h2>
                <span className="text-breu font-display text-[22px] font-medium whitespace-nowrap">
                  {detail.price === 0 ? 'Cortesia' : formatBRL(detail.price)}
                </span>
              </div>
              {detail.description && (
                <p className="text-muted-foreground mt-1.5 text-[12.5px] leading-relaxed">
                  {detail.description}
                </p>
              )}
              <div className="border-border text-grafite mt-4 flex justify-between border-y py-3 text-xs">
                <span>Entrega no quarto</span>
                <span>{booking.roomName}</span>
                <span>Vai para a conta</span>
              </div>
              {!detail.available && (
                <p className="text-muted-foreground mt-3 text-sm font-bold">Esgotado no momento.</p>
              )}
              {orderBlockedReason && (
                <p className="bg-ipe/15 text-breu mt-3 rounded-[18px] p-3 text-[12.5px]">
                  {orderBlockedReason}
                </p>
              )}
            </div>
          </>
        )}
      </Sheet>
      {/* Sacola */}
      <Sheet open={bagOpen} label="Sua sacola" onClose={closeBag}>
        <div className="flex items-center gap-2.5">
          <RoundButton label="Voltar" onClick={() => setBagOpen(false)}>
            <ArrowLeft className="size-[18px]" />
          </RoundButton>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11.5px]">Entrega em</p>
            <p className="truncate text-[14.5px] font-bold">{booking.roomName}</p>
          </div>
        </div>
        <h2 className="font-display mt-5 mb-4 px-0.5 text-[28px] leading-[1.1] tracking-[-0.01em]">
          <span className="font-medium">Sua</span>{' '}
          <span className="text-grafite font-light">sacola</span>
        </h2>
        {cartLines.length === 0 ? (
          <p className="bg-card text-muted-foreground rounded-[24px] p-5 text-center text-[13px]">
            A sacola está vazia.
          </p>
        ) : (
          <>
            <ul className="bg-card rounded-[26px] px-3.5">
              {cartLines.map(([id, q]) => {
                const item = stay.menu.find((m) => m.id === id)
                if (!item) return null
                return (
                  <li
                    key={id}
                    className="[&+&]:border-border flex items-center gap-3 py-3 [&+&]:border-t"
                  >
                    <ItemVisual photoUrl={item.photoUrl} category={item.category} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold">{item.name}</p>
                      <p className="text-muted-foreground text-xs">{formatBRL(item.price * q)}</p>
                    </div>
                    <div className="bg-breu text-neblina flex items-center gap-1 rounded-full p-[3px]">
                      <button
                        type="button"
                        aria-label={q === 1 ? `Remover ${item.name}` : `Menos ${item.name}`}
                        onClick={() => change(item, -1)}
                        className="grid size-7 place-items-center rounded-full"
                      >
                        {q === 1 ? (
                          <Trash2 className="size-3.5" />
                        ) : (
                          <Minus className="size-3.5" strokeWidth={2.8} />
                        )}
                      </button>
                      <span className="min-w-3.5 text-center text-[13px] font-bold">{q}</span>
                      <button
                        type="button"
                        aria-label={`Mais ${item.name}`}
                        disabled={q >= item.maxQuantity}
                        onClick={() => change(item, 1)}
                        className="bg-ipe text-breu grid size-7 place-items-center rounded-full disabled:opacity-40"
                      >
                        <Plus className="size-3.5" strokeWidth={2.8} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Alguma observação? (ex.: bem gelada, deixar na porta)"
              aria-label="Observação do pedido"
              className="bg-card placeholder:text-muted-foreground focus-visible:ring-ipe/60 mt-3 w-full resize-none rounded-[20px] px-4 py-3 text-[13px] outline-none focus-visible:ring-2"
            />
            <p className="text-muted-foreground mt-2 px-1 text-xs">
              Vai para a conta da estadia e é pago no check-out.
              {stay.info.ordersHours ? ` Pedidos ${stay.info.ordersHours}.` : ''}
            </p>
            {orderError && (
              <p role="alert" className="text-destructive mt-2 text-sm font-medium">
                {orderError}
              </p>
            )}
            {orderBlockedReason ? (
              <p className="bg-ipe/15 text-breu mt-3 rounded-[18px] p-3 text-[12.5px]">
                {orderBlockedReason}
              </p>
            ) : (
              <button
                type="button"
                disabled={sending}
                onClick={() => void sendCart()}
                className="bg-breu text-neblina mt-4 flex h-14 w-full items-center justify-between rounded-full pr-2 pl-5 text-[14.5px] font-bold disabled:opacity-60"
              >
                {sending ? 'Enviando…' : 'Enviar pedido'}
                <span className="bg-ipe text-breu rounded-full px-4 py-2.5 text-[13.5px]">
                  {formatBRL(cartTotal)}
                </span>
              </button>
            )}
          </>
        )}
      </Sheet>

      {showBagBar && (
        <div className="fixed inset-x-0 bottom-[100px] z-30 px-[18px]">
          <button
            type="button"
            onClick={() => setBagOpen(true)}
            className="bg-ipe text-breu shadow-floating mx-auto flex w-full max-w-[calc(512px-36px)] items-center gap-2.5 rounded-full py-1.5 pr-1.5 pl-2 text-left"
          >
            <span className="bg-breu/10 grid size-[38px] place-items-center rounded-full font-bold">
              {cartCount}
            </span>
            <span className="flex-1 text-xs leading-tight">
              Sua sacola
              <b className="block text-[15px]">{formatBRL(cartTotal)}</b>
            </span>
            <span className="bg-breu text-neblina rounded-full px-4 py-2.5 text-[13.5px] font-bold">
              Ver sacola
            </span>
          </button>
        </div>
      )}

      {/* Região sempre montada: o leitor de tela anuncia quando o texto entra. */}
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[60] flex justify-center px-4"
      >
        {toast && (
          <p className="bg-breu text-neblina rounded-full px-4 py-2.5 text-[12.5px] font-semibold shadow-lg">
            {toast}
          </p>
        )}
      </div>

      {!detail && !bagOpen && (
        <nav
          data-bottom-bar
          aria-label="Menu do app"
          className="fixed inset-x-0 bottom-[max(20px,env(safe-area-inset-bottom))] z-30 flex justify-center"
        >
          <div className="bg-breu shadow-floating flex gap-1.5 rounded-full p-1.5">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              const badge = t.id === 'pedir' ? cartCount : t.id === 'conta' ? openOrders.length : 0
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => go(t.id)}
                  aria-label={badge > 0 ? `${t.label} (${badge})` : t.label}
                  aria-current={active ? 'page' : undefined}
                  title={t.label}
                  className={cx(
                    'relative grid size-[50px] place-items-center rounded-full transition',
                    active ? 'bg-ipe text-breu' : 'bg-neblina/10 text-neblina',
                  )}
                >
                  <Icon className="size-5" />
                  {badge > 0 && (
                    <span className="text-breu bg-neblina absolute top-0.5 right-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-bold">
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
