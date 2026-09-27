'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { keepValuesOnSubmit } from '@/lib/forms'
import { saveGuestSettingsAction } from '../actions'
import type { GuestSettings } from '../types'
import {
  formatAgenda,
  formatEmergency,
  formatFacilities,
  formatLocalTips,
} from '@/features/estadia/info'

const textareaClass =
  'border-input bg-card text-foreground focus:border-ring resize-y rounded-xl border px-3.5 py-2.5 font-mono text-[13px] outline-none'

function ListField({
  name,
  label,
  hint,
  defaultValue,
  placeholder,
}: {
  name: string
  label: string
  hint: string
  defaultValue: string
  placeholder: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={4}
        maxLength={4000}
        placeholder={placeholder}
        className={textareaClass}
      />
      <span className="text-muted-foreground text-xs">{hint}</span>
    </label>
  )
}

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
        breakfastInfo: String(formData.get('breakfastInfo') ?? ''),
        parkingInfo: String(formData.get('parkingInfo') ?? ''),
        facilities: String(formData.get('facilities') ?? ''),
        dailyAgenda: String(formData.get('dailyAgenda') ?? ''),
        localTips: String(formData.get('localTips') ?? ''),
        emergency: String(formData.get('emergency') ?? ''),
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
      <div className="border-border space-y-3 border-t pt-4">
        <p className="text-foreground text-sm font-semibold">Informações da hospedagem</p>
        <p className="text-muted-foreground -mt-2 text-xs">
          Aparecem no app do hóspede, na aba Estadia. Nas listas, um item por linha e as partes
          separadas por “|”.
        </p>
        <Input
          label="Café da manhã"
          name="breakfastInfo"
          defaultValue={initial.breakfastInfo}
          maxLength={200}
          placeholder="Ex.: 8h às 10h30 · salão principal (incluso)"
        />
        <Input
          label="Estacionamento"
          name="parkingInfo"
          defaultValue={initial.parkingInfo}
          maxLength={200}
          placeholder="Ex.: Gratuito, coberto, ao lado da recepção"
        />
        <ListField
          name="facilities"
          label="Estrutura e horários"
          hint="Nome | horário"
          defaultValue={formatFacilities(initial.facilities)}
          placeholder={'Piscina aquecida | 9h às 21h\nOfurô | 16h às 22h\nSala de jogos | 24h'}
        />
        <ListField
          name="dailyAgenda"
          label="Agenda do dia"
          hint="Horário | atividade | local (opcional). Aparece todo dia em “Hoje na pousada”."
          defaultValue={formatAgenda(initial.dailyAgenda)}
          placeholder={
            '08:00 | Café da manhã | Salão principal\n18:00 | Lareira acesa | Sala de estar\n22:00 | Horário de silêncio'
          }
        />
        <ListField
          name="localTips"
          label="Dicas da região"
          hint="Nome | tipo | distância"
          defaultValue={formatLocalTips(initial.localTips)}
          placeholder={'Pico do Selado | Trilha | 12 km\nFondue no Centrinho | Restaurante | 3 km'}
        />
        <ListField
          name="emergency"
          label="Telefones de emergência"
          hint="Nome | telefone. Se ficar vazio, o app mostra SAMU 192, Bombeiros 193 e Polícia 190."
          defaultValue={formatEmergency(initial.emergency)}
          placeholder={'SAMU | 192\nFarmácia Central | (35) 3438-0000'}
        />
      </div>
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
