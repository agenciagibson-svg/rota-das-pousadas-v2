'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { assignPlatformRoleAction, revokePlatformRoleAction } from '../actions'
import type { PlatformTeamMember, PlatformRoleValue } from '../types'
import { formatDate } from '@/lib/format'

const ROLE_LABEL: Record<PlatformRoleValue, string> = {
  suporte: 'Suporte',
  comercial: 'Comercial',
  marketing: 'Marketing',
  financeiro_plataforma: 'Financeiro',
  master: 'Master',
}
const ROLE_OPTIONS: PlatformRoleValue[] = [
  'suporte',
  'comercial',
  'marketing',
  'financeiro_plataforma',
  'master',
]

/** Data no fuso de Brasília (igual no servidor e no navegador). */
function fmtDate(iso: string): string {
  return formatDate(iso)
}

/**
 * Gestão de papéis de plataforma — fecha o achado crítico da avaliação de
 * 19/09/2026: atribuição só existia via SQL manual e, pior, `profiles_self_update`
 * deixava qualquer usuário se autopromover a master pela API REST direta
 * (corrigido na migration 0054 junto com esta tela). Só master enxerga/usa —
 * as RPCs `list_platform_team`/`set_platform_role_by_email`/
 * `revoke_platform_role_by_email` são master-only no banco.
 */
export function PlatformTeam({ initialTeam }: { initialTeam: PlatformTeamMember[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<PlatformRoleValue>('suporte')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null)

  function assign() {
    setError(null)
    startTransition(async () => {
      const result = await assignPlatformRoleAction({ email, role })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEmail('')
      setRole('suporte')
      router.refresh()
    })
  }

  function revoke(memberEmail: string) {
    setError(null)
    setRevokingEmail(memberEmail)
    startTransition(async () => {
      const result = await revokePlatformRoleAction({ email: memberEmail })
      setRevokingEmail(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="border-border rounded-2xl border p-4">
        <h3 className="text-foreground flex items-center gap-1.5 font-semibold">
          <UserPlus className="text-ocean size-4" />
          Atribuir papel de plataforma
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          A pessoa precisa já ter conta na plataforma (criada em /cadastro). Atribuir um papel novo a
          quem já tem substitui o anterior.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@rotadaspousadas.com.br"
            className="w-64"
            disabled={isPending}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-foreground text-sm font-medium">Papel</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as PlatformRoleValue)}
              disabled={isPending}
              className="border-input bg-card text-foreground focus:border-ring h-10 rounded-xl border px-3 text-sm outline-none"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" disabled={isPending || !email} onClick={assign}>
            {isPending && !revokingEmail ? 'Salvando…' : 'Atribuir'}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-foreground font-semibold">Equipe da plataforma</h3>
        {initialTeam.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Nenhum membro com papel de plataforma ainda.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {initialTeam.map((member) => (
              <div
                key={member.userId}
                className="bg-secondary/50 flex items-center justify-between gap-3 rounded-xl p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground truncate font-medium">
                      {member.fullName || member.email}
                    </span>
                    <span className="bg-ocean/10 text-ocean inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                      <ShieldCheck className="size-3" />
                      {ROLE_LABEL[member.platformRole]}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {member.email} · desde {fmtDate(member.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => revoke(member.email)}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  {isPending && revokingEmail === member.email ? 'Removendo…' : 'Remover papel'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
    </div>
  )
}
