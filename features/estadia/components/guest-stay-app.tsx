'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BedDouble,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  ConciergeBell,
  Home,
  MapPin,
  MessageCircleMore,
  Minus,
  Phone,
  Plus,
  ReceiptText,
  ShoppingBag,
  Star,
  Wifi,
} from 'lucide-react'
import { formatBRL, formatDateTime, formatISODate, plural, whatsappLink } from '@/lib/format'
import { CATEGORY_LABEL, type InventoryCategory } from '@/features/estoque/labels'
import { ORDER_STATUS_LABEL, type GuestOrder } from '@/features/pedidos/types'
import { cancelGuestOrderAction, placeGuestOrderAction, submitStayReviewAction } from '../actions'
import type { GuestStay, StayMenuItem } from '../types'
import { InstallPrompt } from './install-prompt'

type Tab = 'inicio' | 'pedir' | 'conta' | 'recepcao' | 'avaliar'
const REFRESH_MS = 20_000

function CopyText({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
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
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="border-border text-foreground inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copiado!' : label}
    </button>
  )
}

function statusColor(status: GuestOrder['status']) {
  if (status === 'novo') return 'bg-amber-100 text-amber-900'
  if (status === 'preparando') return 'bg-sky-100 text-sky-900'
  if (status === 'entregue') return 'bg-emerald-100 text-emerald-900'
  return 'bg-neutral-100 text-neutral-600'
}

export function GuestStayApp({ stay, orders }: { stay: GuestStay; orders: GuestOrder[] }) {
  const router = useRouter()
  const { booking, pousada, info } = stay
  const [tab, setTab] = useState<Tab>('inicio')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSent, setReviewSent] = useState(false)
  const lastStatus = useRef<Map<string, string> | null>(null)

  const wa = whatsappLink(pousada.whatsapp || pousada.phone)
  const services = stay.menu.filter((m) => m.category === 'servicos')
  const products = stay.menu.filter((m) => m.category !== 'servicos')
  const openOrders = orders.filter((o) => o.status === 'novo' || o.status === 'preparando')

  const grouped = useMemo(() => {
    const map = new Map<InventoryCategory, StayMenuItem[]>()
    for (const item of products) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return [...map.entries()]
  }, [products])

  const cartLines = Object.entries(cart).filter(([, q]) => q > 0)
  const cartTotal = cartLines.reduce(
    (s, [id, q]) => s + (stay.menu.find((m) => m.id === id)?.price ?? 0) * q,
    0,
  )
  const cartCount = cartLines.reduce((s, [, q]) => s + q, 0)

  // Atualiza o status dos pedidos a cada 20 s e avisa quando um for entregue.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [router])

  useEffect(() => {
    const now = new Map(orders.map((o) => [o.id, o.status]))
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
    lastStatus.current = now
  }, [orders])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  function change(item: StayMenuItem, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, Math.min(item.maxQuantity, (prev[item.id] ?? 0) + delta))
      return { ...prev, [item.id]: next }
    })
  }

  async function send(lines: [string, number][], orderNote: string) {
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
      setToast('Pedido enviado! A pousada já recebeu.')
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
    const ok = await send(cartLines, note)
    if (ok) {
      setCart({})
      setNote('')
      setTab('conta')
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

  async function sendReview() {
    setReviewError(null)
    if (rating < 1) {
      setReviewError('Escolha de 1 a 5 estrelas.')
      return
    }
    const res = await submitStayReviewAction({ bookingId: booking.id, rating, text: reviewText })
    if (!res.ok) setReviewError(res.error)
    else {
      setReviewSent(true)
      router.refresh()
    }
  }

  const orderBlockedReason = !stay.ordersEnabled
    ? 'A pousada não está recebendo pedidos pelo app agora. Fale com a recepção.'
    : booking.status === 'checked_out' || booking.checkout < stay.today
      ? 'Sua estadia terminou. Obrigado pela visita!'
      : booking.checkin > stay.today
        ? `Os pedidos ficam liberados a partir do check-in, em ${formatISODate(booking.checkin)}.`
        : null

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [pousada.name, pousada.address, pousada.city, pousada.state].filter(Boolean).join(', '),
  )}`

  const tabs: { id: Tab; label: string; icon: typeof Home; badge?: number }[] = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'pedir', label: 'Pedir', icon: ShoppingBag, badge: cartCount || undefined },
    { id: 'conta', label: 'Conta', icon: ReceiptText, badge: openOrders.length || undefined },
    { id: 'recepcao', label: 'Recepção', icon: ConciergeBell },
    ...(stay.canReview || stay.reviewed
      ? [{ id: 'avaliar' as Tab, label: 'Avaliar', icon: Star }]
      : []),
  ]

  return (
    <div className="bg-background min-h-dvh pb-24">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-lg px-4 pt-5 pb-6">
          <p className="text-xs font-semibold tracking-widest uppercase opacity-80">Sua estadia</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold">{pousada.name}</h1>
          <p className="mt-1 text-sm opacity-90">
            {booking.roomName} · {formatISODate(booking.checkin)} →{' '}
            {formatISODate(booking.checkout)}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {tab === 'inicio' && (
          <>
            <InstallPrompt />
            {pousada.image && (
              <div className="relative aspect-[16/9] overflow-hidden rounded-2xl">
                <Image
                  src={pousada.image}
                  alt={pousada.name}
                  fill
                  sizes="512px"
                  className="object-cover"
                />
              </div>
            )}
            <section className="bg-card border-border rounded-2xl border p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <CalendarDays className="size-3.5" /> Check-in
                  </p>
                  <p className="text-foreground font-semibold">
                    {formatISODate(booking.checkin)} · {pousada.checkinTime}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Clock3 className="size-3.5" /> Check-out
                  </p>
                  <p className="text-foreground font-semibold">
                    {formatISODate(booking.checkout)} · até {pousada.checkoutTime}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <BedDouble className="size-3.5" /> Acomodação
                  </p>
                  <p className="text-foreground font-semibold">{booking.roomName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Reserva</p>
                  <p className="text-foreground font-semibold">
                    {booking.code} ·{' '}
                    {plural(booking.adults + booking.children, 'hóspede', 'hóspedes')}
                  </p>
                </div>
              </div>
            </section>

            {(info.wifiName || info.wifiPassword) && (
              <section className="bg-card border-border rounded-2xl border p-4">
                <h2 className="text-foreground flex items-center gap-2 font-semibold">
                  <Wifi className="text-primary size-4" /> Wi-Fi
                </h2>
                {info.wifiName && (
                  <p className="text-muted-foreground mt-2 text-sm">
                    Rede: <strong className="text-foreground">{info.wifiName}</strong>
                  </p>
                )}
                {info.wifiPassword ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-sm">
                      Senha:{' '}
                      <strong className="text-foreground font-mono">{info.wifiPassword}</strong>
                    </span>
                    <CopyText text={info.wifiPassword} label="Copiar senha" />
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-2 text-xs">
                    A senha aparece aqui no dia do check-in.
                  </p>
                )}
              </section>
            )}

            {info.guestInfo && (
              <section className="bg-card border-border rounded-2xl border p-4">
                <h2 className="text-foreground font-semibold">Recados da pousada</h2>
                <p className="text-muted-foreground mt-2 text-sm whitespace-pre-line">
                  {info.guestInfo}
                </p>
              </section>
            )}

            <section className="bg-card border-border rounded-2xl border p-4">
              <h2 className="text-foreground flex items-center gap-2 font-semibold">
                <MapPin className="text-primary size-4" /> Endereço
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {[pousada.address, pousada.city && `${pousada.city}/${pousada.state}`, pousada.cep]
                  .filter(Boolean)
                  .join(' · ') || `${pousada.city}/${pousada.state}`}
              </p>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-block text-sm font-semibold"
              >
                Como chegar →
              </a>
            </section>

            {pousada.houseRules && (
              <section className="bg-card border-border rounded-2xl border p-4">
                <h2 className="text-foreground font-semibold">Regras da casa</h2>
                <p className="text-muted-foreground mt-2 text-sm whitespace-pre-line">
                  {pousada.houseRules}
                </p>
              </section>
            )}

            {stay.menu.length > 0 && !orderBlockedReason && (
              <button
                type="button"
                onClick={() => setTab('pedir')}
                className="bg-primary text-primary-foreground flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold"
              >
                <ShoppingBag className="size-5" /> Fazer um pedido
              </button>
            )}
          </>
        )}

        {tab === 'pedir' && (
          <>
            <div>
              <h2 className="text-foreground font-serif text-xl font-semibold">
                O que você precisa?
              </h2>
              <p className="text-muted-foreground text-sm">
                Vai para a conta da estadia e é pago no check-out.
                {info.ordersHours ? ` Pedidos ${info.ordersHours}.` : ''}
              </p>
            </div>
            {orderBlockedReason ? (
              <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                {orderBlockedReason}
              </p>
            ) : products.length === 0 ? (
              <p className="text-muted-foreground rounded-2xl border border-dashed p-4 text-sm">
                A pousada ainda não cadastrou itens no app. Fale com a recepção.
              </p>
            ) : (
              grouped.map(([category, list]) => (
                <section key={category}>
                  <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                    {CATEGORY_LABEL[category] ?? category}
                  </h3>
                  <ul className="space-y-2">
                    {list.map((item) => {
                      const q = cart[item.id] ?? 0
                      return (
                        <li
                          key={item.id}
                          className="bg-card border-border flex items-center gap-3 rounded-2xl border p-3"
                        >
                          {item.photoUrl ? (
                            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                              <Image
                                src={item.photoUrl}
                                alt=""
                                fill
                                sizes="56px"
                                className="object-cover"
                              />
                            </div>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground font-medium">{item.name}</p>
                            {item.description && (
                              <p className="text-muted-foreground line-clamp-2 text-xs">
                                {item.description}
                              </p>
                            )}
                            <p className="text-foreground mt-0.5 text-sm font-semibold">
                              {item.price === 0 ? 'Cortesia' : formatBRL(item.price)}
                            </p>
                          </div>
                          {item.available ? (
                            <div className="flex shrink-0 items-center gap-2">
                              {q > 0 && (
                                <>
                                  <button
                                    type="button"
                                    aria-label={`Menos ${item.name}`}
                                    onClick={() => change(item, -1)}
                                    className="border-border flex size-9 items-center justify-center rounded-full border"
                                  >
                                    <Minus className="size-4" />
                                  </button>
                                  <span className="w-5 text-center font-semibold">{q}</span>
                                </>
                              )}
                              <button
                                type="button"
                                aria-label={`Mais ${item.name}`}
                                disabled={q >= item.maxQuantity}
                                onClick={() => change(item, 1)}
                                className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-full disabled:opacity-40"
                              >
                                <Plus className="size-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground shrink-0 text-xs">Esgotado</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            )}

            {cartCount > 0 && (
              <section className="bg-card border-border space-y-3 rounded-2xl border p-4">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="Alguma observação? (ex.: bem gelada, deixar na porta)"
                  aria-label="Observação do pedido"
                  className="border-input bg-background w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
                />
                {orderError && (
                  <p role="alert" className="text-destructive text-sm font-medium">
                    {orderError}
                  </p>
                )}
              </section>
            )}
          </>
        )}

        {tab === 'conta' && (
          <>
            <section className="bg-card border-border rounded-2xl border p-4">
              <h2 className="text-foreground font-semibold">Sua conta de consumo</h2>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-secondary rounded-xl p-2">
                  <p className="text-muted-foreground text-xs">Consumido</p>
                  <p className="text-foreground font-semibold">
                    {formatBRL(stay.consumption.delivered)}
                  </p>
                </div>
                <div className="bg-secondary rounded-xl p-2">
                  <p className="text-muted-foreground text-xs">Pago</p>
                  <p className="text-foreground font-semibold">
                    {formatBRL(stay.consumption.paid)}
                  </p>
                </div>
                <div
                  className={`rounded-xl p-2 ${stay.consumption.balance > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}
                >
                  <p className="text-muted-foreground text-xs">A pagar</p>
                  <p className="text-foreground font-semibold">
                    {formatBRL(stay.consumption.balance)}
                  </p>
                </div>
              </div>
              {stay.consumption.open > 0 && (
                <p className="text-muted-foreground mt-2 text-xs">
                  + {formatBRL(stay.consumption.open)} em pedidos ainda não entregues.
                </p>
              )}
              <p className="text-muted-foreground mt-2 text-xs">
                O consumo é pago na recepção, no check-out. A diária é cobrada à parte.
              </p>
            </section>

            <h3 className="text-muted-foreground pt-2 text-xs font-semibold tracking-wide uppercase">
              Seus pedidos
            </h3>
            {orders.length === 0 ? (
              <p className="text-muted-foreground rounded-2xl border border-dashed p-4 text-sm">
                Nenhum pedido ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {orders.map((o) => (
                  <li key={o.id} className="bg-card border-border rounded-2xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(o.status)}`}
                      >
                        {ORDER_STATUS_LABEL[o.status]}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatDateTime(o.createdAt)}
                      </span>
                    </div>
                    <p className="text-foreground mt-2 text-sm">
                      {o.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}
                    </p>
                    {o.status === 'cancelado' && o.cancelReason && (
                      <p className="text-muted-foreground mt-1 text-xs">Motivo: {o.cancelReason}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-foreground text-sm font-semibold">
                        {formatBRL(o.total)}
                      </span>
                      {o.status === 'novo' && o.source === 'hospede' && (
                        <button
                          type="button"
                          onClick={() => void cancel(o)}
                          className="text-destructive text-xs font-semibold"
                        >
                          Cancelar pedido
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'recepcao' && (
          <>
            <section className="bg-card border-border space-y-3 rounded-2xl border p-4">
              <h2 className="text-foreground font-semibold">Fale com a recepção</h2>
              {wa && (
                <a
                  href={`${wa}?text=${encodeURIComponent(`Olá! Sou hóspede da reserva ${booking.code} (${booking.roomName}).`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white"
                >
                  <MessageCircleMore className="size-5" /> Chamar no WhatsApp
                </a>
              )}
              {pousada.phone && (
                <a
                  href={`tel:${pousada.phone.replace(/[^\d+]/g, '')}`}
                  className="border-border text-foreground flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold"
                >
                  <Phone className="size-5" /> Ligar para a pousada
                </a>
              )}
              {!wa && !pousada.phone && (
                <p className="text-muted-foreground text-sm">
                  A pousada ainda não cadastrou um telefone de contato.
                </p>
              )}
            </section>

            {services.length > 0 && (
              <section className="bg-card border-border rounded-2xl border p-4">
                <h2 className="text-foreground font-semibold">Pedidos rápidos</h2>
                <p className="text-muted-foreground text-sm">Um toque e a equipe recebe.</p>
                {orderBlockedReason ? (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    {orderBlockedReason}
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={sending || !s.available}
                        onClick={() => void send([[s.id, 1]], '')}
                        className="border-border text-foreground hover:bg-secondary flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium disabled:opacity-50"
                      >
                        <span>{s.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {s.price === 0 ? 'sem custo' : formatBRL(s.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {orderError && tab === 'recepcao' && (
                  <p role="alert" className="text-destructive mt-2 text-sm font-medium">
                    {orderError}
                  </p>
                )}
              </section>
            )}
          </>
        )}

        {tab === 'avaliar' && (
          <section className="bg-card border-border rounded-2xl border p-4">
            {stay.reviewed || reviewSent ? (
              <div className="text-center">
                <Star className="mx-auto size-8 fill-amber-400 text-amber-400" />
                <h2 className="text-foreground mt-2 font-semibold">Obrigado pela avaliação!</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Ela aparece na página da pousada e ajuda outros viajantes.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-foreground font-semibold">Como foi a sua estadia?</h2>
                <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Nota">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                      onClick={() => setRating(n)}
                    >
                      <Star
                        className={`size-9 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Conte o que você mais gostou (opcional)"
                  aria-label="Comentário"
                  className="border-input bg-background mt-3 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
                />
                {reviewError && (
                  <p role="alert" className="text-destructive mt-2 text-sm font-medium">
                    {reviewError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void sendReview()}
                  className="bg-primary text-primary-foreground mt-3 w-full rounded-xl px-4 py-3 font-semibold"
                >
                  Enviar avaliação
                </button>
              </>
            )}
          </section>
        )}

        <p className="text-muted-foreground pt-4 text-center text-xs">
          <Link href="/minhas-reservas" className="underline">
            Minhas reservas
          </Link>{' '}
          · Rota das Pousadas
        </p>
      </main>

      {tab === 'pedir' && cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-20 px-4 pb-2">
          <button
            type="button"
            disabled={sending}
            onClick={() => void sendCart()}
            className="bg-primary text-primary-foreground mx-auto flex w-full max-w-lg items-center justify-between rounded-2xl px-5 py-3.5 font-semibold shadow-lg disabled:opacity-60"
          >
            <span>{sending ? 'Enviando…' : `Enviar pedido (${cartCount})`}</span>
            <span>{formatBRL(cartTotal)}</span>
          </button>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-0 top-3 z-30 px-4">
          <p className="bg-foreground text-background mx-auto max-w-lg rounded-xl px-4 py-3 text-sm shadow-lg">
            {toast}
          </p>
        </div>
      )}

      <nav className="bg-card border-border fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="size-5" />
                {t.label}
                {t.badge ? (
                  <span className="bg-destructive absolute top-1.5 right-1/2 translate-x-4 rounded-full px-1.5 text-[10px] text-white">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
