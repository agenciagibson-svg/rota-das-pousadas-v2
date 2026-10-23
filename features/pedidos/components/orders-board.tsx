'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  BellOff,
  Check,
  ChefHat,
  ConciergeBell,
  Plus,
  Printer,
  QrCode,
  X,
} from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL } from '@/lib/format'
import { setOrderStatusAction } from '../actions'
import { ORDER_STATUS_LABEL, type GuestOrder } from '../types'
import type { InHouseBooking, SellableItem } from '../services/orders.service'
import { ChargeForm } from './charge-form'

const REFRESH_MS = 15_000
const SOUND_KEY = 'rp_orders_sound'

function minutesAgo(iso: string, now: number): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  return `há ${h}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`
}

/** Bipe curto (Web Audio) — sem arquivo de som. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const play = (freq: number, at: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.25)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.3)
    }
    play(880, 0)
    play(1175, 0.18)
    setTimeout(() => void ctx.close(), 800)
  } catch {
    // navegador sem áudio — segue sem som
  }
}

function OrderCard({
  order,
  showPrices,
  now,
  onAction,
  pendingId,
}: {
  order: GuestOrder
  showPrices: boolean
  now: number
  onAction: (order: GuestOrder, status: 'preparando' | 'entregue' | 'cancelado') => void
  pendingId: string | null
}) {
  const busy = pendingId === order.id
  const closed = order.status === 'entregue' || order.status === 'cancelado'
  return (
    <div
      className={`rounded-2xl border p-4 ${
        order.status === 'novo' ? 'border-ipe/50 bg-ipe/10' : 'border-border bg-card'
      } ${closed ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/dashboard/reservas/${order.bookingId}`}
            className="text-foreground block truncate font-semibold hover:underline"
          >
            {order.roomName}
          </Link>
          <p className="text-muted-foreground truncate text-xs">
            {order.guestName} · {order.bookingCode}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Badge
            variant={
              order.status === 'novo'
                ? 'goldSoft'
                : order.status === 'preparando'
                  ? 'primarySoft'
                  : order.status === 'cancelado'
                    ? 'destructiveSoft'
                    : 'secondary'
            }
            size="sm"
          >
            {ORDER_STATUS_LABEL[order.status]}
          </Badge>
          <div className="text-muted-foreground mt-1 text-[11px]">
            {minutesAgo(order.createdAt, now)}
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {order.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="text-foreground">
              <strong>{l.quantity}×</strong> {l.name}
            </span>
            {showPrices && (
              <span className="text-muted-foreground whitespace-nowrap">
                {l.lineTotal === 0 ? 'cortesia' : formatBRL(l.lineTotal)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {order.note && (
        <p className="bg-secondary text-foreground mt-2 rounded-xl px-3 py-2 text-sm">
          “{order.note}”
        </p>
      )}
      {order.source === 'equipe' && (
        <p className="text-muted-foreground mt-1 text-xs">Lançado pela equipe</p>
      )}
      {order.status === 'cancelado' && order.cancelReason && (
        <p className="text-muted-foreground mt-1 text-xs">Motivo: {order.cancelReason}</p>
      )}
      {showPrices && (
        <div className="text-foreground mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
          <span>Total</span>
          <span>{formatBRL(order.total)}</span>
        </div>
      )}

      {!closed && (
        <div className="mt-3 flex flex-wrap gap-2">
          {order.status === 'novo' && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAction(order, 'preparando')}
            >
              <ChefHat className="size-3.5" />
              Preparar
            </Button>
          )}
          <Button size="sm" disabled={busy} onClick={() => onAction(order, 'entregue')}>
            <Check className="size-3.5" />
            Entregue
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onAction(order, 'cancelado')}
          >
            <X className="size-3.5" />
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}

export function OrdersBoard({
  displayName,
  pousadaName,
  orders,
  inHouse,
  sellable,
  permissions,
  stayUrl,
  stayQrSvg,
  appItemsCount,
}: {
  displayName: string
  pousadaName: string
  orders: GuestOrder[]
  inHouse: InHouseBooking[]
  sellable: SellableItem[]
  permissions: { operate: boolean; charge: boolean; showPrices: boolean; registerPayment: boolean }
  stayUrl: string
  stayQrSvg: string
  /** `null` = o papel não lê o estoque (governança): sem aviso. */
  appItemsCount: number | null
}) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  const [sound, setSound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<GuestOrder | null>(null)
  const [reason, setReason] = useState('')
  const [charging, setCharging] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const seen = useRef<Set<string> | null>(null)

  const fresh = orders.filter((o) => o.status === 'novo')
  const preparing = orders.filter((o) => o.status === 'preparando')
  const done = orders.filter((o) => o.status === 'entregue' || o.status === 'cancelado')

  useEffect(() => {
    try {
      setSound(localStorage.getItem(SOUND_KEY) === '1')
    } catch {
      // sem storage
    }
  }, [])

  // Atualiza a lista a cada 15 s (e o "há X min").
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      if (document.visibilityState === 'visible') router.refresh()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [router])

  // Pedido novo que não estava na tela → som + título da aba.
  useEffect(() => {
    const ids = new Set(fresh.map((o) => o.id))
    if (seen.current) {
      const arrived = [...ids].some((id) => !seen.current!.has(id))
      if (arrived && sound) beep()
    }
    seen.current = ids
    document.title =
      fresh.length > 0
        ? `(${fresh.length}) Pedidos — Rota das Pousadas`
        : 'Pedidos — Rota das Pousadas'
  }, [fresh, sound])

  function toggleSound() {
    const next = !sound
    setSound(next)
    if (next) beep() // também "destrava" o áudio do navegador
    try {
      localStorage.setItem(SOUND_KEY, next ? '1' : '0')
    } catch {
      // sem storage
    }
  }

  const run = useCallback(
    async (order: GuestOrder, status: 'preparando' | 'entregue' | 'cancelado', why?: string) => {
      setError(null)
      setPendingId(order.id)
      try {
        const res = await setOrderStatusAction({ orderId: order.id, status, reason: why })
        if (!res.ok) {
          setError(res.error)
          return
        }
        setCancelling(null)
        setReason('')
        router.refresh()
      } catch {
        setError('Não foi possível atualizar o pedido. Tente de novo.')
      } finally {
        setPendingId(null)
      }
    },
    [router],
  )

  function onAction(order: GuestOrder, status: 'preparando' | 'entregue' | 'cancelado') {
    if (status === 'cancelado') {
      setCancelling(order)
      return
    }
    void run(order, status)
  }

  const column = (title: string, list: GuestOrder[], empty: string) => (
    <div>
      <h2 className="text-foreground mb-3 flex items-center gap-2 font-semibold">
        {title}
        <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-xs">
          {list.length}
        </span>
      </h2>
      {list.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed p-4 text-sm">
          {empty}
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              showPrices={permissions.showPrices}
              now={now}
              onAction={onAction}
              pendingId={pendingId}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <DashboardShell
      nav={ownerDashboardNav('pedidos')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Pedidos"
      subtitle="O que os hóspedes pedem pelo app, em tempo real."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={sound ? 'default' : 'outline'} onClick={toggleSound}>
          {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          {sound ? 'Som ligado' : 'Ligar som de aviso'}
        </Button>
        {permissions.charge && (
          <Button variant="outline" onClick={() => setCharging(true)}>
            <Plus className="size-4" />
            Lançar consumo
          </Button>
        )}
        <Button variant="outline" onClick={() => setShowQr(true)}>
          <QrCode className="size-4" />
          QR Code do app
        </Button>
        <span className="text-muted-foreground ml-auto text-xs">
          Atualiza sozinho a cada 15 segundos.
        </span>
      </div>
      {error && (
        <p role="alert" className="text-destructive mt-3 text-sm font-medium">
          {error}
        </p>
      )}

      {appItemsCount === 0 && (
        <Card className="border-ipe/50 bg-ipe/15 text-foreground mt-4 p-4 text-sm">
          Nenhum item aparece no app do hóspede ainda. Em{' '}
          <Link href="/dashboard/estoque" className="font-semibold underline">
            Estoque
          </Link>
          , marque “Mostrar no app do hóspede” nos itens que ele pode pedir.
        </Card>
      )}

      {orders.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={ConciergeBell}
          title="Nenhum pedido nas últimas 24 horas"
          description="Quando um hóspede pedir pelo app da estadia, o pedido aparece aqui com aviso."
        />
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {column('Novos', fresh, 'Nenhum pedido novo.')}
          {column('Em preparo', preparing, 'Nada em preparo.')}
          {column('Últimas 24 horas', done, 'Nada entregue ainda.')}
        </div>
      )}

      <Dialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title="Cancelar pedido"
        description="O hóspede vê o motivo no app. Nada é cobrado."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3 || pendingId !== null}
              onClick={() => cancelling && void run(cancelling, 'cancelado', reason.trim())}
            >
              Cancelar pedido
            </Button>
          </>
        }
      >
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="Ex.: acabou o item, fale com a recepção"
          aria-label="Motivo"
          className="border-input bg-card w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
        />
      </Dialog>

      <Dialog
        open={charging}
        onClose={() => setCharging(false)}
        title="Lançar consumo"
        className="max-w-xl"
      >
        {charging && (
          <ChargeForm bookings={inHouse} items={sellable} onDone={() => setCharging(false)} />
        )}
      </Dialog>

      <Dialog
        open={showQr}
        onClose={() => setShowQr(false)}
        title="QR Code do app da estadia"
        description="Imprima e deixe no quarto. O hóspede aponta a câmera, entra com a conta da reserva e já pode pedir."
      >
        <div
          className="mx-auto w-56 rounded-xl border bg-white p-3"
          role="img"
          aria-label="QR Code do app"
          dangerouslySetInnerHTML={{ __html: stayQrSvg }}
        />
        <p className="text-muted-foreground mt-3 text-center text-sm break-all">{stayUrl}</p>
        <div className="mt-4 flex justify-center">
          <Link
            href="/dashboard/pedidos/qrcode"
            target="_blank"
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
          >
            <Printer className="size-4" />
            Abrir para imprimir
          </Link>
        </div>
      </Dialog>
    </DashboardShell>
  )
}
