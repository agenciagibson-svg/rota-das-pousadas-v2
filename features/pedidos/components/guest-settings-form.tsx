'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { keepValuesOnSubmit } from '@/lib/forms'
import { saveGuestSettingsAction } from '../actions'
import type { GuestSettings } from '../types'

/** Informações do app do hóspede: Wi-Fi, recados e pedidos ligados/desligados. */
export function GuestSettingsForm({ initial }: { initial: GuestSettings }) {
  const router = useRouter()
  const [ordersEnabled, setOrdersEnabled] = useState(initial.ordersEnabled)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(formData: FormData) {
    setMessage(null)
    setError(null)
    setPending(true)
    try {
      const res = await saveGuestSettingsAction({
        wifiName: String(formData.get('wifiName') ?? ''),
        wifiPassword: String(formData.get('wifiPassword') ?? ''),
        guestInfo: String(formData.get('guestInfo') ?? ''),
        ordersHours: String(formData.get('ordersHours') ?? ''),
        ordersEnabled,
      })
      if (!res.ok) {
        setError(res.fieldErrors ? (Object.values(res.fieldErrors)[0] ?? res.error) : res.error)
        return
      }
      setMessage('Salvo.')
      router.refresh()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={keepValuesOnSubmit(submit)} className="mt-3 space-y-3" noValidate>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={ordersEnabled}
          onChange={(e) => setOrdersEnabled(e.target.checked)}
        />
        <span>
          <span className="text-foreground font-medium">Receber pedidos pelo app</span>
          <span className="text-muted-foreground block text-xs">
            Desligue quando a equipe não puder atender (o hóspede vê o aviso).
          </span>
        </span>
      </label>
      <Input
        label="Horário dos pedidos (opcional)"
        name="ordersHours"
        defaultValue={initial.ordersHours}
        maxLength={120}
        placeholder="Ex.: das 8h às 22h"
      />
      <Input label="Rede Wi-Fi" name="wifiName" defaultValue={initial.wifiName} maxLength={80} />
      <Input
        label="Senha do Wi-Fi"
        name="wifiPassword"
        defaultValue={initial.wifiPassword}
        maxLength={80}
        hint="Só aparece para o hóspede a partir do dia do check-in."
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Recados para o hóspede
        </span>
        <textarea
          name="guestInfo"
          defaultValue={initial.guestInfo}
          rows={4}
          maxLength={2000}
          placeholder="Ex.: Café da manhã das 8h às 10h30. Piscina até 22h. Estacionamento ao lado da recepção."
          className="border-input bg-card text-foreground focus:border-ring resize-none rounded-xl border px-3.5 py-2.5 text-sm outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
      {message && <p className="text-primary text-sm font-medium">{message}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar informações do app'}
      </Button>
    </form>
  )
}
