'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileSignature, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { publishContractVersionAction, saveContractDraftAction } from '../actions'
import { CONTRACT_FIELDS, openBrackets, unknownContractFields } from '../contract'
import type { ContractVersionAdmin } from '../types'

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

type Message = { tone: 'ok' | 'warn'; text: string }

/**
 * Contrato das pousadas no /admin → Configurações (só master). O texto entra
 * como rascunho; publicar torna a versão a vigente: a partir daí o painel
 * pede o aceite e pousada nova só é publicada depois dele. Versão publicada
 * não muda mais — correção de texto é versão nova.
 */
export function ContractVersionsManager({ versions }: { versions: ContractVersionAdmin[] }) {
  const router = useRouter()
  const draft = versions.find((v) => !v.publishedAt) ?? null
  const [code, setCode] = useState(draft?.code ?? '')
  const [title, setTitle] = useState(draft?.title ?? 'Contrato de parceria com a pousada')
  const [body, setBody] = useState(draft?.bodyTemplate ?? '')
  const [requiresReaccept, setRequiresReaccept] = useState(draft?.requiresReaccept ?? true)
  const [message, setMessage] = useState<Message | null>(null)
  const [pending, start] = useTransition()

  const unknown = unknownContractFields(body)
  const brackets = openBrackets(body)

  function save() {
    setMessage(null)
    start(async () => {
      const result = await saveContractDraftAction({
        code,
        title,
        bodyTemplate: body,
        requiresReaccept,
      })
      if (!result.ok) {
        const field = Object.values(result.fieldErrors ?? {}).flat()[0]
        setMessage({ tone: 'warn', text: field ?? result.error })
        return
      }
      setMessage({ tone: 'ok', text: 'Rascunho salvo. Nada mudou para as pousadas ainda.' })
      router.refresh()
    })
  }

  function publish(target: string) {
    setMessage(null)
    start(async () => {
      const result = await publishContractVersionAction({ code: target })
      if (!result.ok) {
        setMessage({ tone: 'warn', text: result.error })
        return
      }
      setMessage({
        tone: 'ok',
        text: 'Versão publicada. O painel das pousadas já pede o aceite.',
      })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-foreground flex items-center gap-2 font-semibold">
          <FileSignature className="size-4" />
          Contrato das pousadas
        </h2>
        <p className="text-muted-foreground text-sm">
          Enquanto nenhuma versão estiver publicada, o sistema não pede contrato a ninguém. Depois
          de publicar, pousada nova só vai ao ar com o aceite do proprietário.
        </p>
      </div>

      {versions.length > 0 && (
        <ul className="divide-border divide-y">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-foreground text-sm font-medium">
                  {v.title} <span className="text-muted-foreground">· {v.code}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {v.publishedAt
                    ? `Publicada em ${DATE_TIME.format(new Date(v.publishedAt))} · ${
                        v.acceptances === 1 ? '1 aceite' : `${v.acceptances} aceites`
                      }`
                    : `Rascunho, salvo em ${DATE_TIME.format(new Date(v.updatedAt))}`}
                </p>
              </div>
              {v.current ? (
                <Badge variant="primarySoft">Vigente</Badge>
              ) : v.publishedAt ? (
                <Badge variant="secondary">Substituída</Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => publish(v.code)}
                  disabled={pending}
                >
                  <Send className="size-3.5" />
                  Publicar esta versão
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-foreground text-sm font-semibold">
          {draft ? 'Editar o rascunho' : 'Nova versão (rascunho)'}
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Código da versão"
            name="contract-code"
            placeholder="2026-12-v1"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Input
            label="Título"
            name="contract-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <Textarea
          label="Texto do contrato"
          name="contract-body"
          rows={16}
          hint="Linha começando com # vira título. Parágrafos separados por uma linha em branco."
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="text-muted-foreground text-xs">
          <p className="font-medium">Campos que o sistema preenche com os dados de cada pousada:</p>
          <ul className="mt-1 grid gap-1 md:grid-cols-2">
            {CONTRACT_FIELDS.map((field) => (
              <li key={field.token}>
                <code className="text-foreground">{field.token}</code> — {field.label}
              </li>
            ))}
          </ul>
        </div>
        {unknown.length > 0 && (
          <p className="text-destructive text-sm font-medium">
            Campo que o sistema não conhece: {unknown.join(', ')}. Com ele a versão não publica.
          </p>
        )}
        {brackets.length > 0 && (
          <p className="text-destructive text-sm font-medium">
            {brackets.length === 1
              ? 'Ainda há 1 trecho entre colchetes por definir'
              : `Ainda há ${brackets.length} trechos entre colchetes por definir`}
            : {brackets.slice(0, 3).join(' ')}
            {brackets.length > 3 ? ' …' : ''} Com eles a versão não publica.
          </p>
        )}
        <label className="text-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="border-input size-4 rounded"
            checked={requiresReaccept}
            onChange={(event) => setRequiresReaccept(event.target.checked)}
          />
          Pedir novo aceite às pousadas que já aceitaram uma versão anterior
        </label>
        <div>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar rascunho'}
          </Button>
        </div>
        {message && (
          <p
            role="status"
            className={
              message.tone === 'ok'
                ? 'text-success text-sm font-medium'
                : 'text-destructive text-sm font-medium'
            }
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
