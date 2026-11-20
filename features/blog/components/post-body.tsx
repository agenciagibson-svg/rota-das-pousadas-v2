import Image from 'next/image'
import Link from 'next/link'
import { Lightbulb } from 'lucide-react'
import { parseInline } from '../posts'
import type { BlogBlock } from '../types'

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.kind === 'bold' ? (
          <strong key={i} className="text-foreground font-semibold">
            {part.text}
          </strong>
        ) : part.kind === 'link' ? (
          <Link
            key={i}
            href={part.href}
            className="text-foreground font-semibold underline underline-offset-4"
          >
            {part.text}
          </Link>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}

/** Corpo do texto do blog: parágrafos, títulos, listas, fotos, dicas e fichas. */
export function PostBody({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="text-muted-foreground space-y-6 text-lg leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p':
            return (
              <p key={i} className="text-pretty">
                <Inline text={b.text} />
              </p>
            )
          case 'h2':
            return (
              <h2 key={i} className="text-h2 text-foreground pt-6">
                {b.text}
              </h2>
            )
          case 'list':
            return (
              <ul key={i} className="marker:text-ipe list-disc space-y-3 pl-6">
                {b.items.map((item) => (
                  <li key={item} className="pl-1">
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            )
          case 'image':
            return (
              <figure key={i} className="-mx-5 py-2 sm:mx-0">
                <div className="relative aspect-[16/10] overflow-hidden sm:rounded-3xl">
                  <Image
                    src={b.photo.src}
                    alt={b.photo.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-cover"
                  />
                </div>
                {b.caption && (
                  <figcaption className="text-muted-foreground mt-2 px-5 text-sm sm:px-0">
                    {b.caption}{' '}
                    <span className="text-muted-foreground/70">
                      Foto: {b.photo.credit} ({b.photo.license})
                    </span>
                  </figcaption>
                )}
              </figure>
            )
          case 'tip':
            return (
              <aside
                key={i}
                className="bg-card text-foreground flex gap-3 rounded-2xl p-5 text-base leading-relaxed"
              >
                <Lightbulb className="text-ipe mt-0.5 size-5 shrink-0" aria-hidden />
                <p>
                  <span className="font-semibold">Dica: </span>
                  <Inline text={b.text} />
                </p>
              </aside>
            )
          case 'facts':
            return (
              <dl key={i} className="bg-card grid gap-4 rounded-2xl p-5 sm:grid-cols-2">
                {b.items.map((f) => (
                  <div key={f.label}>
                    <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {f.label}
                    </dt>
                    <dd className="text-foreground mt-1 text-base font-medium">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )
        }
      })}
    </div>
  )
}
