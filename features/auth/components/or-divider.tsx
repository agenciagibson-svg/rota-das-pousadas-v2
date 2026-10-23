/** Separador "ou" entre formas de entrar (Google × e-mail). */
export function OrDivider() {
  return (
    <div className="text-muted-foreground flex items-center gap-3 text-xs" aria-hidden="true">
      <span className="bg-border h-px flex-1" />
      ou
      <span className="bg-border h-px flex-1" />
    </div>
  )
}
