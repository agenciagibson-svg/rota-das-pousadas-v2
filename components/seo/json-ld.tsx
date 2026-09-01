/**
 * Renders a JSON-LD structured-data script. Server component — safe to embed
 * anywhere in the tree. The payload is trusted (built server-side), so
 * dangerouslySetInnerHTML is appropriate here.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
