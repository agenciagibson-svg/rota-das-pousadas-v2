import { describe, expect, it } from 'vitest'
import { buildSetupSteps, summarizeSetup, type SetupInput } from './setup'

const pronta: SetupInput = {
  gallery: ['/a.jpg', '/b.jpg', '/c.jpg'],
  image: '/a.jpg',
  description: 'Pousada na serra com café colonial, lareira nos chalés e trilhas até a cachoeira.',
  checkinTime: '14:00',
  checkoutTime: '12:00',
  cancellationPolicy: 'Cancelamento grátis até 7 dias antes.',
  whatsapp: '35999990000',
  notificationEmail: 'reservas@pousada.test',
  sellableRooms: 3,
  roomsWithoutPhotos: 0,
  pixEnabled: true,
  subscriptionActive: true,
  cardConnected: false,
  channels: 0,
  teamMembers: 1,
}

describe('configuração guiada', () => {
  it('pousada pronta: todos os obrigatórios feitos, opcionais não contam', () => {
    const p = summarizeSetup(buildSetupSteps(pronta))
    expect(p.complete).toBe(true)
    expect(p.missingRequired).toBe(0)
    expect(p.steps.filter((s) => s.optional).every((s) => !s.done || s.id === 'cartao')).toBe(true)
  })

  it('cada falta derruba só o próprio passo', () => {
    const p = summarizeSetup(
      buildSetupSteps({ ...pronta, gallery: ['/a.jpg'], image: '/a.jpg', pixEnabled: false }),
    )
    expect(p.complete).toBe(false)
    expect(p.missingRequired).toBe(2)
    expect(p.steps.find((s) => s.id === 'fotos')?.done).toBe(false)
    expect(p.steps.find((s) => s.id === 'pix')?.done).toBe(false)
    expect(p.steps.find((s) => s.id === 'descricao')?.done).toBe(true)
  })

  it('a capa fora da galeria conta como foto', () => {
    const steps = buildSetupSteps({ ...pronta, gallery: ['/b.jpg', '/c.jpg'], image: '/a.jpg' })
    expect(steps.find((s) => s.id === 'fotos')?.done).toBe(true)
  })

  it('acomodação sem foto mantém o passo pendente e diz quantas', () => {
    const step = buildSetupSteps({ ...pronta, roomsWithoutPhotos: 2 }).find(
      (s) => s.id === 'acomodacoes',
    )
    expect(step?.done).toBe(false)
    expect(step?.hint).toBe('2 acomodações estão sem foto.')
  })

  it('descrição curta não vale', () => {
    const step = buildSetupSteps({ ...pronta, description: 'Pousada boa.' }).find(
      (s) => s.id === 'descricao',
    )
    expect(step?.done).toBe(false)
  })
})
