'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUp, RotateCcw, Star, Users } from 'lucide-react'
import { MagicWand } from '@/components/brand/magic-wand'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { STARTER_REPLIES } from '@/features/concierge/ai/local-engine'
import type { ConciergeCard, ConciergeReply } from '@/features/concierge/ai/types'

type Entry = {
  role: 'user' | 'assistant'
  content: string
  cards?: ConciergeCard[]
  /** Saudação inicial: fica na tela, não vai para o servidor. */
  intro?: boolean
}

const STORAGE_KEY = 'rota:concierge-chat:v1'
const MAX_SENT = 20

const GREETING: Entry = {
  role: 'assistant',
  intro: true,
  content:
    'Oi! Sou o concierge da Rota. Escreve do seu jeito — “praia com a família”, “cabana na floresta”, “resort”, “serra com lareira”, “viagem com pets” — que eu procuro nas pousadas da Rota, pergunto o que falta e deixo a reserva pronta.',
}

function readStored(): { entries: Entry[]; quick: string[] } | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { entries?: Entry[]; quick?: string[] }
    if (!Array.isArray(data.entries) || !data.entries.length) return null
    return { entries: data.entries, quick: Array.isArray(data.quick) ? data.quick : [] }
  } catch {
    return null
  }
}

/**
 * Conversa com o concierge (ChatGPT quando configurado, modo local sem a
 * chave). Os cartões e links de reserva vêm do servidor, a partir do
 * catálogo — o modelo não escreve links nem preços.
 */
export function ConciergeChat() {
  const [entries, setEntries] = useState<Entry[]>([GREETING])
  const [quick, setQuick] = useState<string[]>(STARTER_REPLIES)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState<ConciergeReply['engine'] | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const restored = useRef(false)

  // Volta para a conversa ao retornar de uma pousada (mesma aba).
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const stored = readStored()
    if (!stored) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do sessionStorage após montar (o servidor não o enxerga)
    setEntries(stored.entries)
    setQuick(stored.quick)
  }, [])

  useEffect(() => {
    try {
      if (entries.length > 1) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, quick }))
      }
    } catch {
      /* armazenamento indisponível: a conversa segue só na memória */
    }
  }, [entries, quick])

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' })
  }, [entries, pending])

  async function send(text: string) {
    const content = text.trim().slice(0, 800)
    if (!content || pending) return
    const next: Entry[] = [...entries, { role: 'user', content }]
    setEntries(next)
    setDraft('')
    setError(null)
    setPending(true)
    try {
      const response = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next
            .filter((e) => !e.intro)
            .slice(-MAX_SENT)
            .map(({ role, content: c }) => ({ role, content: c.slice(0, 800) })),
        }),
      })
      const data = (await response.json().catch(() => null)) as
        (ConciergeReply & { error?: string }) | null
      if (!response.ok || !data || data.error) {
        throw new Error(data?.error || 'Não consegui responder agora.')
      }
      setEntries((list) => [...list, { role: 'assistant', content: data.reply, cards: data.cards }])
      setQuick(data.quickReplies)
      setEngine(data.engine)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui responder agora.')
    } finally {
      setPending(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void send(draft)
  }

  function restart() {
    setEntries([GREETING])
    setQuick(STARTER_REPLIES)
    setError(null)
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* nada a limpar */
    }
    inputRef.current?.focus()
  }

  return (
    <section
      aria-labelledby="concierge-chat-title"
      className="bg-card border-border/60 overflow-hidden rounded-3xl border"
    >
      <header className="border-border/60 flex items-center gap-3 border-b px-5 py-4 lg:px-6">
        <span className="concierge-wand-badge relative flex size-11 shrink-0 items-center justify-center rounded-full">
          <MagicWand className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="concierge-chat-title" className="text-h3 text-foreground">
            Converse com o concierge
          </h2>
          <p className="text-muted-foreground text-xs">
            {engine === 'local'
              ? 'Modo rápido: busca por palavras-chave no catálogo.'
              : 'Inteligência artificial que busca só nas pousadas da Rota.'}
          </p>
        </div>
        {entries.length > 1 ? (
          <button
            type="button"
            onClick={restart}
            className={cn(buttonVariants({ variant: 'ghost', size: 'pill-sm' }), 'shrink-0')}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Recomeçar
          </button>
        ) : null}
      </header>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={pending}
        className="h-[min(62vh,560px)] space-y-5 overflow-y-auto overscroll-contain px-4 py-5 lg:px-6"
      >
        {entries.map((entry, index) => (
          <div key={index} className="space-y-3">
            <Bubble entry={entry} />
            {entry.cards?.length ? <Cards cards={entry.cards} /> : null}
          </div>
        ))}
        {pending ? (
          <div className="flex items-center gap-2" aria-label="O concierge está procurando">
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3 text-sm">
              <span className="concierge-typing" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              Procurando pousadas…
            </span>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <div className="border-border/60 border-t px-4 pt-3 pb-4 lg:px-6">
        {quick.length ? (
          <div className="-mx-1 mb-3 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 pb-1">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                disabled={pending}
                onClick={() => void send(q)}
                className="border-border text-foreground hover:bg-muted focus-visible:ring-ipe/60 h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <label htmlFor="concierge-mensagem" className="sr-only">
            Mensagem para o concierge
          </label>
          <textarea
            ref={inputRef}
            id="concierge-mensagem"
            rows={1}
            maxLength={800}
            value={draft}
            enterKeyHint="send"
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void send(draft)
              }
            }}
            placeholder="Ex.: praia com pets em janeiro"
            className="border-border bg-background focus-visible:border-foreground focus-visible:ring-ipe/60 max-h-32 min-h-12 flex-1 resize-none rounded-3xl border px-5 py-3 text-base transition-colors outline-none focus-visible:ring-2 sm:text-sm"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            aria-label="Enviar mensagem"
            className="bg-foreground text-background focus-visible:ring-ipe/60 flex size-12 shrink-0 items-center justify-center rounded-full transition-opacity outline-none focus-visible:ring-2 disabled:opacity-40"
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </form>
        <p className="text-muted-foreground mt-2 text-[0.7rem]">
          Não peça nem envie dados pessoais aqui. Valores finais aparecem na reserva.
        </p>
      </div>
    </section>
  )
}

function Bubble({ entry }: { entry: Entry }) {
  const mine = entry.role === 'user'
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <p
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line sm:max-w-[75%]',
          mine
            ? 'bg-foreground text-background rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md',
        )}
      >
        <span className="sr-only">{mine ? 'Você: ' : 'Concierge: '}</span>
        {entry.content}
      </p>
    </div>
  )
}

function Cards({ cards }: { cards: ConciergeCard[] }) {
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
      {cards.map((card) => (
        <li
          key={card.slug}
          className="bg-background border-border/60 flex w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border sm:w-auto"
        >
          <div className="relative aspect-[4/3]">
            <Image
              src={card.image}
              alt={`${card.name}, em ${card.city}`}
              fill
              sizes="(min-width: 1280px) 260px, (min-width: 640px) 45vw, 78vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div>
              <h3 className="text-foreground text-sm font-semibold">{card.name}</h3>
              <p className="text-muted-foreground text-xs">
                {card.city}/{card.state}
              </p>
            </div>
            <p className="text-muted-foreground flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <Star className="fill-ipe text-ipe size-3.5" aria-hidden />
                {card.rating.toFixed(1)}
                <span className="sr-only">de 5, {card.reviews} avaliações</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                até {card.capacity}
              </span>
            </p>
            {card.reasons.length ? (
              <div className="flex flex-wrap gap-1.5">
                {card.reasons.slice(0, 3).map((reason) => (
                  <Badge key={reason} variant="secondary" size="sm">
                    {reason}
                  </Badge>
                ))}
              </div>
            ) : null}
            <p className="text-foreground mt-auto pt-1 text-sm">
              {card.total != null && card.nights ? (
                <>
                  <strong className="font-semibold">{formatPrice(card.total)}</strong>
                  <span className="text-muted-foreground text-xs">
                    {' '}
                    · {card.nights} {card.nights === 1 ? 'noite' : 'noites'}
                  </span>
                </>
              ) : (
                <>
                  <strong className="font-semibold">{formatPrice(card.pricePerNight)}</strong>
                  <span className="text-muted-foreground text-xs"> / noite</span>
                </>
              )}
            </p>
            <div className="flex flex-col gap-2">
              {card.reserveHref ? (
                <Link
                  href={card.reserveHref}
                  className={cn(buttonVariants({ variant: 'accent', size: 'pill-sm' }), 'h-10')}
                >
                  Reservar agora
                </Link>
              ) : null}
              <Link
                href={card.pageHref}
                className={cn(buttonVariants({ variant: 'outline', size: 'pill-sm' }), 'h-10')}
              >
                Ver a pousada
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
