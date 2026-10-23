import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStoredImageUrl, isUploadedPhotoUrl } from './image-url'

describe('isStoredImageUrl', () => {
  it('aceita caminho do site e http(s), recusa // e vazio quando pedido', () => {
    expect(isStoredImageUrl('/placeholder.svg')).toBe(true)
    expect(isStoredImageUrl('https://exemplo.com/a.jpg')).toBe(true)
    expect(isStoredImageUrl('//evil.com/a.jpg')).toBe(false)
    expect(isStoredImageUrl('', false)).toBe(false)
  })
})

describe('isUploadedPhotoUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('aceita o bucket pousadas e caminhos do próprio site', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(isUploadedPhotoUrl('https://x.supabase.co/storage/v1/object/public/pousadas/p/acomodacoes/a.jpg')).toBe(true)
    expect(isUploadedPhotoUrl('/images/quarto.jpg')).toBe(true)
  })

  it('recusa outro site, outro bucket, // e rotas de API', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(isUploadedPhotoUrl('https://evil.com/foto.jpg')).toBe(false)
    expect(isUploadedPhotoUrl('https://x.supabase.co/storage/v1/object/public/outro/a.jpg')).toBe(false)
    expect(isUploadedPhotoUrl('//evil.com/storage/v1/object/public/pousadas/a.jpg')).toBe(false)
    expect(isUploadedPhotoUrl('/api/cron/expiracao')).toBe(false)
    expect(isUploadedPhotoUrl('javascript:alert(1)')).toBe(false)
  })

  it('com o Supabase configurado, só o host do projeto', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    expect(isUploadedPhotoUrl('https://abc.supabase.co/storage/v1/object/public/pousadas/a.jpg')).toBe(true)
    expect(isUploadedPhotoUrl('https://outro.supabase.co/storage/v1/object/public/pousadas/a.jpg')).toBe(false)
  })
})
