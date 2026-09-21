'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Search, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { LoginAttemptRow } from '../types'

/** Mesmo teto de falhas usado pelo bloqueio de login (`assert_login_not_locked`, 0053). */
const LOCKOUT_THRESHOLD = 5

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * Relatório de login — segunda seção da tela "Auditoria", ao lado da trilha
 * de eventos. Janela de ~24h só: `login_attempts` (0053) se autolimpa
 * sozinha (é rate limiting, não histórico longo) — isto detecta um ataque em
 * andamento ou ajuda a investigar um caso concreto, não substitui um SIEM.
 * IP sempre mascarado (decisão de 21/09/2026 com Gibson: privacidade antes
 * de geolocalização precisa, que exigiria um serviço externo). Destaca
 * e-mails com 5+ falhas recentes — mesmo teto do bloqueio de login.
 */
export function LoginAttemptsView({ initialAttempts }: { initialAttempts: LoginAttemptRow[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')

  function applyFilter() {
    startTransition(() => {
      const params = new URLSearchParams(window.location.search)
      if (email.trim()) {
        params.set('loginEmail', email.trim())
      } else {
        params.delete('loginEmail')
      }
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  function clearFilter() {
    setEmail('')
    startTransition(() => {
      const params = new URLSearchParams(window.location.search)
      params.delete('loginEmail')
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  const failuresByEmail = new Map<string, number>()
  for (const a of initialAttempts) {
    if (!a.success) failuresByEmail.set(a.email, (failuresByEmail.get(a.email) ?? 0) + 1)
  }
  const failedCount = initialAttempts.filter((a) => !a.success).length
  const suspiciousEmails = [...failuresByEmail.entries()].filter(([, n]) => n >= LOCKOUT_THRESHOLD)

  return (
    <div className="space-y-4">
      <div className="border-border flex flex-wrap items-end gap-3 rounded-2xl border p-4">
        <Input
          label="E-mail contém"
          placeholder="ex.: proprietario@..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-64"
          disabled={isPending}
        />
        <Button type="button" onClick={applyFilter} disabled={isPending}>
          <Search className="mr-1.5 size-4" />
          Filtrar
        </Button>
        <button
          type="button"
          onClick={clearFilter}
          disabled={isPending}
          className="text-muted-foreground text-sm hover:underline disabled:opacity-50"
        >
          Limpar
        </button>
      </div>

      <p className="text-muted-foreground text-sm">
        {initialAttempts.length} tentativa(s) nas últimas ~24h · {failedCount} falharam
      </p>

      {suspiciousEmails.length > 0 && (
        <div className="bg-destructive/10 flex flex-wrap items-center gap-2 rounded-xl p-3">
          <AlertTriangle className="text-destructive size-4 shrink-0" />
          <span className="text-destructive text-sm font-medium">
            Possível ataque: {suspiciousEmails.map(([e, n]) => `${e} (${n} falhas)`).join(', ')}
          </span>
        </div>
      )}

      {initialAttempts.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma tentativa encontrada.</p>
      ) : (
        <div className="space-y-2">
          {initialAttempts.map((a) => (
            <div
              key={a.id}
              className="bg-secondary/50 flex items-center justify-between gap-3 rounded-xl p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                {a.success ? (
                  <CheckCircle2 className="text-primary size-4 shrink-0" />
                ) : (
                  <XCircle className="text-destructive size-4 shrink-0" />
                )}
                <span className="text-foreground truncate text-sm font-medium">{a.email}</span>
                <Badge variant={a.success ? 'primarySoft' : 'destructiveSoft'} size="sm">
                  {a.success ? 'sucesso' : 'falha'}
                </Badge>
              </div>
              <div className="text-muted-foreground shrink-0 text-right text-xs">
                <div>{fmtDateTime(a.createdAt)}</div>
                <div className="font-mono">{a.ipMasked ?? 'IP não registrado'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
