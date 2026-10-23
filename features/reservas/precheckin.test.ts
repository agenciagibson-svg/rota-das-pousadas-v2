import { describe, expect, it } from 'vitest'
import {
  buildPrecheckinDefaults,
  companionLimitError,
  emailOffersPrecheckin,
  guestPrecheckinState,
  precheckinCompanionSchema,
  precheckinPath,
  precheckinSchema,
  staffPrecheckinBadge,
  storedCompanionDocuments,
  type PrecheckinInput,
  type PrecheckinSnapshot,
} from './precheckin'

const valid: PrecheckinInput = {
  bookingId: '30000000-0000-4000-8000-000000000881',
  phone: '(34) 91234-5678',
  birthDate: '1985-04-10',
  nationality: 'brasileira',
  documentNumber: '',
  hasStoredDocument: true,
  country: 'BR',
  cep: '38400-000',
  address: 'Rua das Flores, 100 - Centro',
  city: 'Uberlândia',
  state: 'MG',
  companions: [],
  expectedArrivalTime: '15:30',
}

function issues(input: unknown) {
  const r = precheckinSchema.safeParse(input)
  return r.success
    ? {}
    : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('precheckinSchema', () => {
  it('aceita a ficha completa mantendo o documento salvo', () => {
    expect(precheckinSchema.safeParse(valid).success).toBe(true)
  })

  it('sem documento salvo exige CPF válido', () => {
    expect(issues({ ...valid, hasStoredDocument: false })).toHaveProperty(
      'documentNumber',
      'Informe seu CPF.',
    )
    expect(issues({ ...valid, documentNumber: '123.456.789-00' })).toHaveProperty(
      'documentNumber',
      'CPF inválido.',
    )
    expect(precheckinSchema.safeParse({ ...valid, documentNumber: '529.982.247-25' }).success).toBe(
      true,
    )
  })

  it('estrangeiro: passaporte, país e telefone internacional', () => {
    const foreign = {
      ...valid,
      nationality: 'estrangeira',
      hasStoredDocument: false,
      documentNumber: 'AB123456',
      country: 'Argentina',
      state: '',
      cep: '',
      phone: '+54 11 1234-5678',
    }
    expect(precheckinSchema.safeParse(foreign).success).toBe(true)
    expect(issues({ ...foreign, country: 'BR' })).toHaveProperty('country')
    expect(issues({ ...foreign, documentNumber: 'AB-12' })).toHaveProperty('documentNumber')
  })

  it('recusa menor de idade, UF ausente, endereço curto, horário e celular inválidos', () => {
    expect(issues({ ...valid, birthDate: '2015-01-01' })).toHaveProperty('birthDate')
    expect(issues({ ...valid, state: '' })).toHaveProperty('state', 'Informe a UF.')
    expect(issues({ ...valid, address: 'Rua' })).toHaveProperty('address')
    expect(issues({ ...valid, expectedArrivalTime: '25:00' })).toHaveProperty('expectedArrivalTime')
    expect(issues({ ...valid, phone: '1234' })).toHaveProperty('phone')
  })

  it('horário de chegada é opcional', () => {
    expect(precheckinSchema.safeParse({ ...valid, expectedArrivalTime: '' }).success).toBe(true)
  })
})

describe('precheckinCompanionSchema', () => {
  const adult = {
    keepDocumentOf: '',
    fullName: 'Ana Souza',
    guestType: 'adult' as const,
    birthDate: '1990-01-01',
    documentType: 'RG' as const,
    documentNumber: 'MG-12.345.678',
  }

  it('adulto precisa de nascimento e documento', () => {
    expect(precheckinCompanionSchema.safeParse(adult).success).toBe(true)
    expect(precheckinCompanionSchema.safeParse({ ...adult, birthDate: '' }).success).toBe(false)
    expect(
      precheckinCompanionSchema.safeParse({ ...adult, documentType: '', documentNumber: '' })
        .success,
    ).toBe(false)
  })

  it('adulto pode manter o documento já salvo', () => {
    const keep = {
      ...adult,
      documentType: '' as const,
      documentNumber: '',
      keepDocumentOf: '88000000-0000-4000-8000-000000000002',
    }
    expect(precheckinCompanionSchema.safeParse(keep).success).toBe(true)
  })

  it('criança e bebê: documento e nascimento opcionais', () => {
    const child = {
      ...adult,
      guestType: 'child' as const,
      birthDate: '',
      documentType: '' as const,
      documentNumber: '',
    }
    expect(precheckinCompanionSchema.safeParse(child).success).toBe(true)
    expect(precheckinCompanionSchema.safeParse({ ...child, guestType: 'infant' }).success).toBe(
      true,
    )
  })

  it('documento sem tipo, CPF inválido, nome com número e tipo "responsible"', () => {
    expect(precheckinCompanionSchema.safeParse({ ...adult, documentType: '' }).success).toBe(false)
    expect(
      precheckinCompanionSchema.safeParse({
        ...adult,
        documentType: 'CPF',
        documentNumber: '111.111.111-11',
      }).success,
    ).toBe(false)
    expect(precheckinCompanionSchema.safeParse({ ...adult, fullName: 'Ana 2' }).success).toBe(false)
    expect(
      precheckinCompanionSchema.safeParse({ ...adult, guestType: 'responsible' }).success,
    ).toBe(false)
  })

  it('nascimento no futuro é recusado', () => {
    expect(precheckinCompanionSchema.safeParse({ ...adult, birthDate: '2999-01-01' }).success).toBe(
      false,
    )
  })
})

describe('companionLimitError', () => {
  const limits = { maxCompanions: 2, maxInfants: 2 }

  it('bebê não conta na capacidade', () => {
    const list = [
      { guestType: 'adult' as const },
      { guestType: 'child' as const },
      { guestType: 'infant' as const },
    ]
    expect(companionLimitError(list, limits)).toBeNull()
  })

  it('passa do limite', () => {
    const list = [
      { guestType: 'adult' as const },
      { guestType: 'adult' as const },
      { guestType: 'child' as const },
    ]
    expect(companionLimitError(list, limits)).toMatch(/mais 2 pessoas/)
    expect(
      companionLimitError([{ guestType: 'adult' }], { maxCompanions: 0, maxInfants: 2 }),
    ).toMatch(/só para você/)
    expect(
      companionLimitError(
        [{ guestType: 'infant' }, { guestType: 'infant' }, { guestType: 'infant' }],
        limits,
      ),
    ).toMatch(/Bebês demais/)
  })
})

describe('quando mostrar', () => {
  const today = '2097-04-20'
  const base = { status: 'confirmed' as const, checkout: '2097-05-03', paymentDueAt: null }

  it('hóspede: pendente/confirmada mostra "Preencher ficha" até enviar', () => {
    expect(guestPrecheckinState(base, today)).toBe('todo')
    expect(
      guestPrecheckinState({ ...base, precheckinCompletedAt: '2097-04-19T10:00:00Z' }, today),
    ).toBe('done')
    expect(
      guestPrecheckinState(
        { ...base, status: 'pending', paymentDueAt: '2999-01-01T00:00:00Z' },
        today,
      ),
    ).toBe('todo')
  })

  it('hóspede: cancelada, encerrada, prazo vencido e estadia passada não mostram', () => {
    const now = new Date('2097-04-20T12:00:00Z')
    expect(guestPrecheckinState({ ...base, status: 'cancelled' }, today)).toBeNull()
    expect(guestPrecheckinState({ ...base, status: 'checked_out' }, today)).toBeNull()
    expect(
      guestPrecheckinState(
        { ...base, status: 'pending', paymentDueAt: '2097-04-20T11:00:00Z' },
        today,
        now,
      ),
    ).toBeNull()
    expect(guestPrecheckinState({ ...base, checkout: '2097-04-19' }, today)).toBeNull()
  })

  it('hóspede em estadia: "Ficha enviada" só se enviou', () => {
    expect(guestPrecheckinState({ ...base, status: 'checked_in' }, today)).toBeNull()
    expect(
      guestPrecheckinState({ ...base, status: 'checked_in', precheckinCompletedAt: 'x' }, today),
    ).toBe('done')
  })

  it('equipe: badge só de hoje em diante', () => {
    const badge = (
      status: Parameters<typeof staffPrecheckinBadge>[0]['status'],
      checkin: string,
      done: boolean,
    ) => staffPrecheckinBadge({ status, checkin, precheckinDone: done }, today)
    expect(badge('confirmed', today, false)).toBe('pending')
    expect(badge('pending', '2097-05-01', true)).toBe('done')
    expect(badge('confirmed', '2097-04-19', false)).toBeNull()
    expect(badge('cancelled', today, false)).toBeNull()
    expect(badge('checked_in', today, true)).toBe('done')
    expect(badge('checked_in', today, false)).toBeNull()
  })

  it('e-mail: só com ficha pendente, conta de hóspede e reserva ativa', () => {
    expect(
      emailOffersPrecheckin({
        precheckinDone: false,
        hasTravelerAccount: true,
        status: 'confirmed',
      }),
    ).toBe(true)
    expect(emailOffersPrecheckin({ precheckinDone: true, hasTravelerAccount: true })).toBe(false)
    expect(emailOffersPrecheckin({ precheckinDone: false, hasTravelerAccount: false })).toBe(false)
    expect(emailOffersPrecheckin({})).toBe(false)
    expect(
      emailOffersPrecheckin({
        precheckinDone: false,
        hasTravelerAccount: true,
        status: 'cancelled',
      }),
    ).toBe(false)
  })

  it('caminho do formulário', () => {
    expect(precheckinPath('abc')).toBe('/minhas-reservas/abc/pre-check-in')
  })
})

describe('buildPrecheckinDefaults', () => {
  const snapshot: PrecheckinSnapshot = {
    bookingId: valid.bookingId,
    code: 'RP-1',
    status: 'confirmed',
    checkin: '2097-05-01',
    checkout: '2097-05-03',
    adults: 3,
    children: 0,
    infants: 0,
    expectedArrivalTime: null,
    precheckinCompletedAt: null,
    pousadaName: 'Pousada A',
    checkinTime: '14:00',
    canSubmit: true,
    maxCompanions: 2,
    maxInfants: 2,
    responsible: {
      fullName: 'Hóspede Teste',
      phone: '(34) 90000-0000',
      birthDate: null,
      nationality: null,
      country: 'BR',
      city: 'Cidade da Ficha',
      state: 'sp',
      address: null,
      cep: null,
      documentType: 'CPF',
      documentLast4: '0909',
      hasDocument: true,
    },
    companions: [
      {
        id: 'c1',
        fullName: 'Ana',
        guestType: 'adult',
        birthDate: '1990-01-01',
        documentType: 'RG',
        hasDocument: true,
      },
      {
        id: 'c2',
        fullName: 'Bia',
        guestType: 'child',
        birthDate: null,
        documentType: null,
        hasDocument: false,
      },
    ],
  }
  const profile = {
    phone: '(34) 91111-1111',
    birthDate: '1985-04-10',
    country: 'BR',
    city: 'Uberlândia',
    state: 'MG',
    address: 'Rua do Perfil, 1',
    cep: '38400-000',
  }

  it('antes de enviar, o perfil do viajante vem primeiro e a ficha completa', () => {
    const d = buildPrecheckinDefaults(snapshot, profile)
    expect(d.phone).toBe('(34) 91111-1111')
    expect(d.city).toBe('Uberlândia')
    expect(d.state).toBe('MG')
    expect(d.hasStoredDocument).toBe(true)
    expect(d.documentNumber).toBe('')
    expect(d.companions).toEqual([
      {
        keepDocumentOf: 'c1',
        previousId: 'c1',
        fullName: 'Ana',
        guestType: 'adult',
        birthDate: '1990-01-01',
        documentType: '',
        documentNumber: '',
      },
      {
        keepDocumentOf: '',
        previousId: 'c2',
        fullName: 'Bia',
        guestType: 'child',
        birthDate: '',
        documentType: '',
        documentNumber: '',
      },
    ])
  })

  it('depois de enviar, a ficha manda', () => {
    const d = buildPrecheckinDefaults(
      { ...snapshot, precheckinCompletedAt: '2097-04-01T10:00:00Z', expectedArrivalTime: '16:00' },
      profile,
    )
    expect(d.phone).toBe('(34) 90000-0000')
    expect(d.city).toBe('Cidade da Ficha')
    expect(d.state).toBe('SP')
    expect(d.expectedArrivalTime).toBe('16:00')
  })

  it('estrangeiro não aproveita o CPF salvo', () => {
    const d = buildPrecheckinDefaults(
      {
        ...snapshot,
        responsible: { ...snapshot.responsible, country: 'Argentina', nationality: 'Estrangeira' },
      },
      null,
    )
    expect(d.nationality).toBe('estrangeira')
    expect(d.hasStoredDocument).toBe(false)
    expect(d.state).toBe('')
  })

  it('documentos guardados dos acompanhantes', () => {
    expect(storedCompanionDocuments(snapshot)).toEqual({ c1: 'RG' })
  })
})
