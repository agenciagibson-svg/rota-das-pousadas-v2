'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarSync, Check, Copy, Link2, Plus, Trash2 } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { AcomodacoesTabs } from '@/features/acomodacoes/components/acomodacoes-tabs'
import { removeChannelAction, saveChannelAction } from '../actions'
import { CHANNEL_PROVIDER_LABEL, type ChannelCalendar, type ChannelProvider } from '../types'
import type { ManagedRoom } from '@/features/acomodacoes/types'
import { keepValuesOnSubmit } from '@/lib/forms'

const PROVIDERS: ChannelProvider[] = ['airbnb', 'booking', 'outro']

/** Onde o anfitrião encontra o link — a pergunta nº 1 de quem configura isso. */
const ONDE_ENCONTRAR: Record<ChannelProvider, string> = {
  airbnb:
    'No Airbnb: Calendário → Disponibilidade → Sincronizar calendários → Exportar calendário.',
  booking: 'No Booking: Extranet → Tarifas e Disponibilidade → Sincronização de calendário.',
  outro: 'Procure por "exportar calendário", "iCal" ou ".ics" no painel do canal.',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return 'nunca'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function SyncBadge({ channel }: { channel: ChannelCalendar }) {
  if (!channel.importUrl) return <Badge variant="secondary">Só exporta</Badge>
  if (channel.lastSyncStatus === 'error') return <Badge variant="destructiveSoft">Falha</Badge>
  if (channel.lastSyncStatus === 'never')
    return <Badge variant="goldSoft">Aguardando 1ª sincronização</Badge>
  return <Badge variant="primarySoft">Sincronizado</Badge>
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Alguns navegadores bloqueiam a área de transferência sem HTTPS ou
          // sem gesto do usuário. O link continua visível e selecionável ao lado.
          setCopied(false)
        }
      }}
      className="border-input text-foreground hover:bg-secondary inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
      aria-label="Copiar link do calendário"
    >
      {copied ? <Check className="text-primary size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function NewChannelForm({ rooms, onDone }: { rooms: ManagedRoom[]; onDone: () => void }) {
  const router = useRouter()
  const [provider, setProvider] = useState<ChannelProvider>('airbnb')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(formData: FormData) {
    setError(null)
    setPending(true)
    const result = await saveChannelAction({
      roomId: String(formData.get('roomId') ?? ''),
      provider: String(formData.get('provider') ?? 'airbnb') as ChannelProvider,
      label: String(formData.get('label') ?? ''),
      importUrl: String(formData.get('importUrl') ?? '').trim(),
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={keepValuesOnSubmit(onSubmit)} className="space-y-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Acomodação
        </span>
        <select
          name="roomId"
          required
          className="border-input bg-card text-foreground rounded-xl border px-3.5 py-2.5 text-sm outline-none"
        >
          <option value="">Selecione…</option>
          {rooms
            .filter((r) => r.status === 'active')
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Canal
        </span>
        <select
          name="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as ChannelProvider)}
          className="border-input bg-card text-foreground rounded-xl border px-3.5 py-2.5 text-sm outline-none"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {CHANNEL_PROVIDER_LABEL[p]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Link do calendário do canal
        </span>
        <Input name="importUrl" type="url" placeholder="https://..." inputMode="url" />
        <span className="text-muted-foreground text-xs">{ONDE_ENCONTRAR[provider]}</span>
        <span className="text-muted-foreground text-xs">
          Pode deixar em branco se você só quer publicar o seu calendário para o canal ler.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Apelido (opcional)
        </span>
        <Input name="label" maxLength={80} placeholder="Ex.: anúncio do chalé no Airbnb" />
      </label>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar canal'}
        </Button>
      </div>
    </form>
  )
}

export function ChannelsView({
  displayName,
  pousadaName,
  channels,
  rooms,
  canManage,
}: {
  displayName: string
  pousadaName: string
  channels: ChannelCalendar[]
  rooms: ManagedRoom[]
  canManage: boolean
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<ChannelCalendar | null>(null)
  const [pending, setPending] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  async function confirmRemove() {
    if (!removing) return
    setPending(true)
    setRemoveError(null)
    try {
      const result = await removeChannelAction({ calendarId: removing.id })
      if (!result.ok) {
        setRemoveError(result.error)
        return
      }
      setRemoving(null)
      router.refresh()
    } catch {
      setRemoveError('Não foi possível remover o canal. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  function closeRemove() {
    setRemoving(null)
    setRemoveError(null)
  }

  const comFalha = channels.filter((c) => c.lastSyncStatus === 'error')

  return (
    <DashboardShell
      nav={ownerDashboardNav('acomodacoes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Canais"
      subtitle="Sincronize o calendário com Airbnb, Booking e outros para não vender a mesma noite duas vezes."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <AcomodacoesTabs active="canais" />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Cada acomodação tem dois links por canal: o que a Rota <strong>lê</strong> do canal, e o
          que a Rota
          <strong> publica</strong> para o canal ler. Os dois precisam estar colados para a proteção
          funcionar nas duas direções.
        </p>
        {canManage && (
          <Button onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="size-4" /> Novo canal
          </Button>
        )}
      </div>

      {comFalha.length > 0 && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive mt-4 flex items-start gap-2.5 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {comFalha.length === 1
                ? '1 canal não está sincronizando'
                : `${comFalha.length} canais não estão sincronizando`}
            </p>
            <p className="text-destructive/80 mt-1">
              As datas já conhecidas continuam bloqueadas — nenhuma acomodação foi liberada por
              engano. Mas bloqueios criados no canal desde a última sincronização ainda não chegaram
              aqui.
            </p>
          </div>
        </div>
      )}

      {channels.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={CalendarSync}
          title="Nenhum canal configurado"
          description="Se a sua pousada também vende no Airbnb ou no Booking, conecte o calendário para evitar reserva duplicada na mesma noite."
          action={
            canManage ? (
              <Button onClick={() => setCreating(true)}>Conectar um canal</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-5 grid gap-4">
          {channels.map((channel) => (
            <Card key={channel.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-foreground font-semibold">{channel.roomName}</h2>
                    <Badge variant="secondary">{CHANNEL_PROVIDER_LABEL[channel.provider]}</Badge>
                    <SyncBadge channel={channel} />
                  </div>
                  {channel.label && (
                    <p className="text-muted-foreground mt-1 text-sm">{channel.label}</p>
                  )}
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    onClick={() => setRemoving(channel)}
                    className="text-destructive gap-1.5"
                  >
                    <Trash2 className="size-4" /> Remover
                  </Button>
                )}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="bg-secondary/40 rounded-xl p-3.5">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    A Rota lê deste link
                  </p>
                  {channel.importUrl ? (
                    <>
                      <p className="text-foreground mt-1.5 text-xs break-all">
                        {channel.importUrl}
                      </p>
                      <p className="text-muted-foreground mt-2 text-xs">
                        Última sincronização: {fmtDateTime(channel.lastSyncAt)}
                        {channel.lastSyncStatus === 'ok' &&
                          ` · ${channel.lastEventCount} ${channel.lastEventCount === 1 ? 'período ocupado' : 'períodos ocupados'}`}
                      </p>
                      {channel.lastSyncStatus === 'error' && channel.lastSyncError && (
                        <p className="text-destructive mt-1.5 text-xs">{channel.lastSyncError}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      Nenhum link informado — este canal só publica.
                    </p>
                  )}
                </div>

                <div className="bg-secondary/40 rounded-xl p-3.5">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Cole este link no canal
                  </p>
                  <div className="mt-1.5 flex items-start gap-2">
                    <p className="text-foreground min-w-0 flex-1 text-xs break-all">
                      {channel.exportUrl}
                    </p>
                    <CopyButton value={channel.exportUrl} />
                  </div>
                  <p className="text-muted-foreground mt-2 flex items-start gap-1.5 text-xs">
                    <Link2 className="mt-0.5 size-3 shrink-0" />
                    Este link mostra apenas as datas ocupadas. Nenhum dado do hóspede aparece nele.
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} title="Novo canal">
        <NewChannelForm rooms={rooms} onDone={() => setCreating(false)} />
      </Dialog>

      <Dialog open={removing !== null} onClose={closeRemove} title="Remover canal">
        <p className="text-muted-foreground text-sm">
          Os bloqueios que vieram de{' '}
          {removing ? CHANNEL_PROVIDER_LABEL[removing.provider] : 'canal'} para {removing?.roomName}{' '}
          serão apagados, e essas datas voltam a ficar disponíveis para venda na Rota. O link que
          você colou no canal também para de funcionar.
        </p>
        {removeError && (
          <p role="alert" className="text-destructive mt-3 text-sm font-medium">
            {removeError}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={closeRemove}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmRemove} disabled={pending}>
            {pending ? 'Removendo…' : 'Remover canal'}
          </Button>
        </div>
      </Dialog>
    </DashboardShell>
  )
}
