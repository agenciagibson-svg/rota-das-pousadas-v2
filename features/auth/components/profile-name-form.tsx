'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateMyNameAction } from '../actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function ProfileNameForm({ initialName }: { initialName: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStatus('saving')
    const result = await updateMyNameAction({ name: name.trim() })
    if (!result.ok) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setStatus('saved')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          label="Nome completo"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setStatus('idle')
          }}
          error={error ?? undefined}
        />
      </div>
      <Button type="submit" disabled={status === 'saving' || name.trim() === initialName.trim()}>
        {status === 'saving' ? 'Salvando…' : status === 'saved' ? 'Salvo' : 'Salvar'}
      </Button>
    </form>
  )
}
