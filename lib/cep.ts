import 'server-only'

export type CepAddress = {
  cep: string
  street: string
  district: string
  city: string
  state: string
}

/** `null` = CEP não existe; `'unavailable'` = serviços fora do ar (não bloquear o usuário). */
export type CepLookup = CepAddress | null | 'unavailable'

const TIMEOUT_MS = 4000

async function viaCep(cep: string): Promise<CepLookup> {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 60 * 60 * 24 * 7 },
  })
  if (res.status === 400) return null
  if (!res.ok) return 'unavailable'
  const j = (await res.json()) as Record<string, unknown>
  if (j.erro) return null
  return {
    cep,
    street: String(j.logradouro ?? ''),
    district: String(j.bairro ?? ''),
    city: String(j.localidade ?? ''),
    state: String(j.uf ?? '').toUpperCase(),
  }
}

async function brasilApi(cep: string): Promise<CepLookup> {
  const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 60 * 60 * 24 * 7 },
  })
  if (res.status === 404) return null
  if (!res.ok) return 'unavailable'
  const j = (await res.json()) as Record<string, unknown>
  return {
    cep,
    street: String(j.street ?? ''),
    district: String(j.neighborhood ?? ''),
    city: String(j.city ?? ''),
    state: String(j.state ?? '').toUpperCase(),
  }
}

/**
 * Endereço de um CEP. Tenta o ViaCEP e, se estiver fora do ar, a BrasilAPI.
 * Resposta cacheada por 7 dias (CEP quase nunca muda).
 */
export async function lookupCep(raw: string): Promise<CepLookup> {
  const cep = raw.replace(/\D/g, '')
  if (!/^\d{8}$/.test(cep) || /^(\d)\1{7}$/.test(cep)) return null
  for (const provider of [viaCep, brasilApi]) {
    try {
      const result = await provider(cep)
      if (result !== 'unavailable') return result
    } catch {
      // timeout/rede: tenta o próximo
    }
  }
  return 'unavailable'
}
