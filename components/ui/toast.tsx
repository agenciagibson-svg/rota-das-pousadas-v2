'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'
type ToastData = { id: string; title: string; description?: string; variant: ToastVariant }

type ToastContextValue = { toast: (t: Omit<ToastData, 'id'>) => void }
const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

const iconByVariant = { success: CheckCircle2, error: AlertCircle, info: Info } as const
const toneByVariant = {
  success: 'text-primary',
  error: 'text-destructive',
  info: 'text-ocean',
} as const

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

/**
 * Wrap the app (or a subtree) in <ToastProvider> and call `useToast().toast(...)`.
 * Toasts auto-dismiss after 5s and stack in a portal at the bottom-right.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [toasts, setToasts] = useState<ToastData[]>([])
  useEffect(() => setMounted(true), [])

  const dismiss = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])

  const toast = useCallback<ToastContextValue['toast']>(
    (t) => {
      const id = newId()
      setToasts((prev) => [...prev, { ...t, id }])
      setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-2">
            {toasts.map((t) => {
              const Icon = iconByVariant[t.variant]
              return (
                <div
                  key={t.id}
                  role="status"
                  className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg"
                >
                  <Icon className={cn('mt-0.5 size-5 shrink-0', toneByVariant[t.variant])} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{t.title}</div>
                    {t.description && <div className="mt-0.5 text-sm text-muted-foreground">{t.description}</div>}
                  </div>
                  <button
                    onClick={() => dismiss(t.id)}
                    aria-label="Fechar notificação"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}
