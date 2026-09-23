'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

/** Pede o motivo antes de cancelar consumo ou estornar pagamento — fica na auditoria. */
export function FolioReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  function close() {
    setReason('')
    onClose()
  }

  function confirm() {
    const value = reason.trim()
    setReason('')
    onConfirm(value)
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={confirm}
            disabled={pending || reason.trim().length < 3}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Textarea
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Motivo (obrigatório)"
      />
    </Dialog>
  )
}
