/**
 * Renders a JSON-LD structured-data script. Server component — safe to embed
 * anywhere in the tree.
 *
 * O payload é montado no servidor, mas pode incluir texto de usuário (nome de
 * pousada, descrição) por trás de `pousadaJsonLd()` — então NÃO tratamos como
 * confiável. `JSON.stringify` sozinho não escapa `<`, e um valor como
 * `</script><script>...` dentro do JSON fecharia a tag e injetaria HTML/JS
 * arbitrário na página. Escapamos `<`, `>` e `&` como sequências Unicode
 * (válidas dentro de uma string JSON, inertes fora de uma) antes de
 * `dangerouslySetInnerHTML` — mesma técnica usada por Next.js/Remix para
 * JSON embutido em `<script>`.
 */
function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"

      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  )
}
