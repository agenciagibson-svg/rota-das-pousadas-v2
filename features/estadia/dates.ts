/** Datas do app da estadia (datas ISO "AAAA-MM-DD", sem fuso). */

function asDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`)
}

/** "Sáb, 27 set" */
export function shortDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = asDate(iso)
  const wd = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .format(d)
    .replace('.', '')
  const dm = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(d)
    .replace('.', '')
    .replace(' de ', ' ')
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${dm}`
}

/** "27 set" */
export function dayMonth(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(asDate(iso))
    .replace('.', '')
    .replace(' de ', ' ')
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((asDate(toIso).getTime() - asDate(fromIso).getTime()) / 86_400_000)
}

/** "14:00" → "14h"; "10:30" → "10h30". */
export function hourLabel(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return hhmm
  const h = String(Number(m[1]))
  return m[2] === '00' ? `${h}h` : `${h}h${m[2]}`
}

/** Hora atual "HH:MM" no fuso da pousada. */
export function nowHHMM(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date())
  }
}
