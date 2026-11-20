/**
 * Origem da visita (0106) — regras puras, usadas no navegador e no servidor.
 *
 * O navegador guarda num cookie próprio do site a origem da última visita
 * que veio de algum lugar (link com UTM ou outro site). Ao criar a reserva, o
 * servidor lê o cookie e grava a origem na reserva. Nada de dado pessoal:
 * só os parâmetros do link, o site de onde a pessoa veio e a página em que
 * ela entrou.
 */

export const ORIGIN_COOKIE = 'rp_origem'
/** 30 dias: quem volta para reservar depois ainda leva a origem. */
export const ORIGIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export type VisitOrigin = {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  /** Site de onde a pessoa veio (só o domínio). */
  referrerHost?: string
  /** Página em que entrou (sem a query). */
  landingPath?: string
  clickId?: 'gclid' | 'fbclid'
  /** ISO da visita. */
  at: string
}

export type Channel =
  | 'google_ads'
  | 'perfil_google'
  | 'google'
  | 'instagram'
  | 'facebook'
  | 'whatsapp'
  | 'direto'
  | 'outro'
  | 'sem_registro'

export const CHANNEL_LABEL: Record<Channel, string> = {
  google_ads: 'Anúncio no Google',
  perfil_google: 'Perfil da pousada no Google',
  google: 'Busca do Google',
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  direto: 'Acesso direto',
  outro: 'Outro site',
  sem_registro: 'Sem registro de origem',
}

export function channelLabel(channel: string | null | undefined): string {
  return channel && channel in CHANNEL_LABEL
    ? CHANNEL_LABEL[channel as Channel]
    : CHANNEL_LABEL.sem_registro
}

const clip = (v: string | null | undefined, max: number) => {
  const t = (v ?? '').trim()
  return t ? t.slice(0, max) : undefined
}

/**
 * Origem desta visita, ou `null` quando ela não traz nada novo (acesso direto
 * ou navegação dentro do próprio site): nesse caso a origem anterior fica.
 */
export function originFromVisit(
  href: string,
  referrer: string,
  now: Date = new Date(),
): VisitOrigin | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  const p = url.searchParams
  let referrerHost: string | undefined
  try {
    const r = referrer ? new URL(referrer) : null
    if (
      r &&
      r.hostname &&
      r.hostname !== url.hostname &&
      !r.hostname.endsWith(`.${url.hostname}`)
    ) {
      referrerHost = r.hostname.toLowerCase().slice(0, 150)
    }
  } catch {
    referrerHost = undefined
  }
  const clickId = p.get('gclid') ? 'gclid' : p.get('fbclid') ? 'fbclid' : undefined
  const origin: VisitOrigin = {
    source: clip(p.get('utm_source'), 100),
    medium: clip(p.get('utm_medium'), 100),
    campaign: clip(p.get('utm_campaign'), 150),
    content: clip(p.get('utm_content'), 150),
    term: clip(p.get('utm_term'), 150),
    referrerHost,
    landingPath: url.pathname.slice(0, 300),
    clickId,
    at: now.toISOString(),
  }
  const hasSomething = origin.source || origin.medium || origin.campaign || referrerHost || clickId
  return hasSomething ? origin : null
}

export function encodeOrigin(origin: VisitOrigin): string {
  return encodeURIComponent(JSON.stringify(origin))
}

export function decodeOrigin(raw: string | null | undefined): VisitOrigin | null {
  if (!raw) return null
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<VisitOrigin>
    if (!v || typeof v !== 'object' || typeof v.at !== 'string') return null
    const s = (x: unknown, max: number) => (typeof x === 'string' ? clip(x, max) : undefined)
    return {
      source: s(v.source, 100),
      medium: s(v.medium, 100),
      campaign: s(v.campaign, 150),
      content: s(v.content, 150),
      term: s(v.term, 150),
      referrerHost: s(v.referrerHost, 150),
      landingPath: s(v.landingPath, 300),
      clickId: v.clickId === 'gclid' || v.clickId === 'fbclid' ? v.clickId : undefined,
      at: v.at,
    }
  } catch {
    return null
  }
}

/**
 * Links da pousada com a origem marcada, para ela colar no perfil do Google,
 * na bio do Instagram e no WhatsApp. É assim que o painel separa os canais.
 */
export function marketingLinks(siteUrl: string, slug: string) {
  const base = siteUrl.replace(/\/$/, '')
  const tag = (source: string, medium: string) =>
    `utm_source=${source}&utm_medium=${medium}&utm_campaign=${encodeURIComponent(slug)}`
  return {
    googleProfile: `${base}/pousada/${slug}?${tag('google', 'perfil')}`,
    instagramBio: `${base}/${slug}?${tag('instagram', 'bio')}`,
    whatsapp: `${base}/pousada/${slug}?${tag('whatsapp', 'mensagem')}`,
  }
}
