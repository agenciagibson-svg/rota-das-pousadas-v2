import { describe, expect, it } from 'vitest'
import { guideWhatsappText, whatsappNumber } from './guide'
import { welcomeGuideEmail } from '@/lib/email/welcome-guide-email'

const links = {
  googleProfile:
    'https://rota.test/pousada/sol?utm_source=google&utm_medium=perfil&utm_campaign=sol',
  instagramBio: 'https://rota.test/sol?utm_source=instagram&utm_medium=bio&utm_campaign=sol',
  whatsapp:
    'https://rota.test/pousada/sol?utm_source=whatsapp&utm_medium=mensagem&utm_campaign=sol',
}

describe('guia de links', () => {
  it('normaliza o número para o wa.me', () => {
    expect(whatsappNumber('(32) 99999-0000')).toBe('5532999990000')
    expect(whatsappNumber('+55 32 99999-0000')).toBe('5532999990000')
    expect(whatsappNumber('123')).toBeNull()
    expect(whatsappNumber(null)).toBeNull()
  })

  it('texto do WhatsApp leva os 3 links e o painel', () => {
    const text = guideWhatsappText({
      pousadaName: 'Pousada do Sol',
      links,
      panelUrl: 'https://rota.test/dashboard/link',
    })
    expect(text).toContain('Pousada do Sol')
    for (const url of Object.values(links)) expect(text).toContain(url)
    expect(text).toContain('https://rota.test/dashboard/link')
  })

  it('e-mail de boas-vindas traz os links da pousada, o passo a passo e escapa o nome', () => {
    const email = welcomeGuideEmail({
      pousadaName: 'Pousada <Sol>',
      ownerName: 'Ana Maria',
      links,
      panelUrl: 'https://rota.test/dashboard/link',
      pageUrl: 'https://rota.test/pousada/sol',
    })
    expect(email.subject).toContain('Pousada <Sol>')
    expect(email.html).toContain('Pousada &lt;Sol&gt;')
    expect(email.html).not.toContain('<Sol>')
    expect(email.html).toContain('Olá, Ana!')
    expect(email.html).toContain('Editar perfil')
    expect(email.text).toContain(links.instagramBio)
    expect(email.html).toContain(links.googleProfile.replace(/&/g, '&amp;'))
    // Nada de prometer confirmação imediata.
    expect(email.text).not.toMatch(/na hora/i)
  })
})
