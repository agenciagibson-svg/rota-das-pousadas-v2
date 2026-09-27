'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CalendarCheck,
  Check,
  Copy,
  Mail,
  MessageCircleMore,
  MessageSquare,
  MessageSquareText,
  Users,
} from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BOOKING_STATUS } from '@/features/reservas'
import { formatISODate, isEmail, plural, whatsappLink } from '@/lib/format'
import type { OwnerPousadaSettings, OwnerReservation } from '../types'

const DAY_MS = 86_400_000

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (new Date(`${toISO}T00:00:00Z`).getTime() - new Date(`${fromISO}T00:00:00Z`).getTime()) /
      DAY_MS,
  )
}

/** Assunto do contato pelo momento da reserva (não só pelo status). */
function messageSubject(r: OwnerReservation, todayISO: string): string {
  if (r.status === 'pending' || r.status === 'quote') return 'Pagamento pendente'
  if (r.status === 'checked_in') return 'Hospedado agora'
  if (r.status === 'checked_out') return 'Pedir avaliação'
  if (r.status === 'confirmed') {
    const d = daysBetween(todayISO, r.checkin)
    if (d <= 0) return 'Chega hoje'
    if (d === 1) return 'Chega amanhã'
    if (d <= 7) return `Chega em ${d} dias`
    return 'Reserva confirmada'
  }
  return 'Reserva'
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

function quickMessage(
  r: OwnerReservation,
  settings: OwnerPousadaSettings | null,
  pousadaName: string,
): string {
  const checkin = settings?.checkinTime || '14:00'
  const checkout = settings?.checkoutTime || '12:00'
  const name = firstName(r.guestName)
  const period = `${formatISODate(r.checkin)} a ${formatISODate(r.checkout)}`

  if (r.status === 'pending' || r.status === 'quote') {
    return `Olá, ${name}! Aqui é da ${pousadaName}. Sua reserva ${r.code} (${period}) está aguardando pagamento. Se precisar de ajuda para concluir, é só responder esta mensagem.`
  }
  if (r.status === 'confirmed') {
    return `Olá, ${name}! Aqui é da ${pousadaName}. Sua reserva ${r.code} está confirmada para ${period}. O check-in começa às ${checkin} e o check-out é até ${checkout}. Qual o horário previsto da sua chegada?`
  }
  if (r.status === 'checked_in') {
    return `Olá, ${name}! Aqui é da ${pousadaName}. Está tudo certo com a sua estadia? Se precisar de qualquer coisa, estamos à disposição. Lembrando que o check-out é até ${checkout}.`
  }
  if (r.status === 'checked_out') {
    return `Olá, ${name}! Obrigado por se hospedar na ${pousadaName}. Esperamos que tenha aproveitado! Sua avaliação ajuda muito a gente e outros viajantes.`
  }
  return `Olá, ${name}! Aqui é da ${pousadaName}, sobre a sua reserva ${r.code} (${period}).`
}

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="border-input text-foreground hover:bg-secondary inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copiado!' : label}
    </button>
  )
}

/**
 * Contato com os hóspedes: para cada reserva em andamento, uma mensagem pronta
 * (pelo momento da reserva) e atalhos para enviar pelo WhatsApp ou e-mail.
 * Não é um chat — as conversas acontecem no WhatsApp/e-mail da pousada.
 */
export function OwnerMessagesView({
  displayName,
  pousadaName,
  reservations,
  settings,
  todayISO,
}: {
  displayName: string
  pousadaName: string
  reservations: OwnerReservation[]
  settings: OwnerPousadaSettings | null
  /** "Hoje" no fuso da pousada. */
  todayISO: string
}) {
  // Só quem ainda precisa de contato: pendentes, confirmadas e hospedados, e
  // quem saiu nos últimos 14 dias (pedir avaliação). Canceladas ficam de fora.
  const recentLimit = new Date(new Date(`${todayISO}T00:00:00Z`).getTime() - 14 * DAY_MS)
    .toISOString()
    .slice(0, 10)
  const inbox = reservations
    .filter((r) => {
      if (r.status === 'cancelled' || r.status === 'no_show') return false
      if (r.status === 'checked_out') return r.checkout >= recentLimit
      return r.checkout >= todayISO || r.status === 'checked_in'
    })
    .sort((a, b) => a.checkin.localeCompare(b.checkin))

  const pendingPayments = inbox.filter((r) => r.status === 'pending' || r.status === 'quote')
  const arrivingSoon = inbox.filter(
    (r) => r.status === 'confirmed' && daysBetween(todayISO, r.checkin) <= 7,
  )
  const inHouse = inbox.filter((r) => r.status === 'checked_in')

  const quickReplies = [
    {
      title: 'Horário de check-in',
      text: `O check-in começa às ${settings?.checkinTime || '14:00'}.`,
    },
    {
      title: 'Horário de check-out',
      text: `O check-out é até ${settings?.checkoutTime || '12:00'}.`,
    },
    { title: 'Regras da casa', text: settings?.houseRules || '' },
    { title: 'Política de cancelamento', text: settings?.cancellationPolicy || '' },
  ]

  return (
    <DashboardShell
      nav={ownerDashboardNav('mensagens')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Mensagens"
      subtitle="Mensagens prontas para cada hóspede — envie pelo WhatsApp ou e-mail com um clique."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Pagamentos pendentes</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">
            {pendingPayments.length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Chegadas nos próximos 7 dias</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">{arrivingSoon.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Hospedados agora</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">{inHouse.length}</div>
        </Card>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl">
              <MessageSquare className="size-5" />
            </span>
            <div>
              <h2 className="text-foreground font-semibold">Hóspedes para contatar</h2>
              <p className="text-muted-foreground text-sm">
                Reservas em andamento, da chegada mais próxima para a mais distante.
              </p>
            </div>
          </div>

          {inbox.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={MessageSquare}
              title="Ninguém para contatar agora"
              description="Quando houver reservas pendentes, confirmadas ou hóspedes na casa, eles aparecem aqui com a mensagem pronta."
            />
          ) : (
            <div className="mt-6 space-y-3">
              {inbox.map((r) => {
                const status = BOOKING_STATUS[r.status]
                const message = quickMessage(r, settings, pousadaName)
                const wa = whatsappLink(r.guestPhone)
                const hasEmail = isEmail(r.guestEmail)
                return (
                  <div key={r.id} className="border-border rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/reservas/${r.id}`}
                        className="text-foreground font-serif text-lg font-semibold hover:underline"
                      >
                        {r.guestName}
                      </Link>
                      <Badge variant={status.variant} size="sm">
                        {status.label}
                      </Badge>
                      <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                        {messageSubject(r, todayISO)}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <CalendarCheck className="size-3.5 shrink-0" />
                        {formatISODate(r.checkin)} → {formatISODate(r.checkout)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Users className="size-3.5 shrink-0" />
                        {plural(r.guests, 'hóspede', 'hóspedes')}
                      </span>
                      <span>{r.code}</span>
                    </div>

                    <div className="bg-secondary text-foreground mt-3 rounded-2xl p-3 text-sm leading-relaxed">
                      {message}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {wa && (
                        <a
                          href={`${wa}?text=${encodeURIComponent(message)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          <MessageCircleMore className="size-3.5" />
                          Enviar no WhatsApp
                        </a>
                      )}
                      {hasEmail && (
                        <a
                          href={`mailto:${r.guestEmail}?subject=${encodeURIComponent(
                            `Reserva ${r.code} - ${pousadaName}`,
                          )}&body=${encodeURIComponent(message)}`}
                          className="border-input text-foreground hover:bg-secondary inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                        >
                          <Mail className="size-3.5" />
                          Enviar por e-mail
                        </a>
                      )}
                      <CopyButton text={message} label="Copiar mensagem" />
                      {!wa && !hasEmail && (
                        <span className="text-muted-foreground self-center text-xs">
                          Sem telefone nem e-mail —{' '}
                          <Link
                            href={`/dashboard/reservas/${r.id}`}
                            className="text-primary hover:underline"
                          >
                            ver reserva
                          </Link>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="text-foreground flex items-center gap-2 font-semibold">
            <MessageSquareText className="text-primary size-4" />
            Respostas rápidas
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Textos da sua pousada para copiar e colar nas conversas.
          </p>
          <div className="mt-4 space-y-3">
            {quickReplies.map((item) => (
              <div key={item.title} className="border-border rounded-2xl border p-3">
                <div className="text-foreground text-sm font-semibold">{item.title}</div>
                {item.text ? (
                  <>
                    <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">
                      {item.text}
                    </p>
                    <div className="mt-2">
                      <CopyButton text={item.text} />
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground mt-1 text-sm">
                    Ainda não cadastrado.{' '}
                    <Link href="/dashboard/configuracoes" className="text-primary hover:underline">
                      Cadastrar em Configurações
                    </Link>
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}
