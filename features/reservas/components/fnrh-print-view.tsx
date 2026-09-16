import Link from 'next/link'
import { GUEST_TYPE_LABEL } from './guest-type-labels'
import { PrintButton } from './print-button'
import { fnrhDate as fmtDate, fnrhDocument as fmtDoc, fnrhCountryLabel as countryLabel } from '../fnrh-format'
import type { FnrhData } from '../types'

/**
 * Ficha FNRH imprimível de uma reserva. Só projeta o que já está
 * cadastrado no perfil do hóspede — campos que o negócio não rastreia hoje
 * (profissão, procedência, destino, meio de transporte, placa) entram em
 * branco, para o hóspede completar à mão na recepção, igual à prática comum
 * com o formulário do Ministério do Turismo.
 */
export function FnrhPrintView({ data, bookingId }: { data: FnrhData; bookingId: string }) {
  const { pousada, booking, responsible, companions } = data
  const totalGuests = booking.adults + booking.children + booking.infants

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/dashboard/reservas/${bookingId}`} className="text-sm text-muted-foreground hover:underline">
          ← Voltar para a reserva
        </Link>
        <PrintButton />
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-white p-8 text-neutral-900 print:rounded-none print:border-0 print:p-0">
        <header className="border-b border-neutral-300 pb-4 text-center">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Ficha Nacional de Registro de Hóspedes — FNRH
          </p>
          <h1 className="mt-1 text-lg font-bold">{pousada.legalName}</h1>
          <p className="text-sm text-neutral-600">
            {[
              pousada.taxId && `CNPJ/CPF: ${pousada.taxId}`,
              pousada.address,
              pousada.city && pousada.state ? `${pousada.city}/${pousada.state}` : pousada.city || pousada.state,
              pousada.cep,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <span className="text-neutral-500">Reserva</span>
            <p className="font-medium">{booking.code}</p>
          </div>
          <div>
            <span className="text-neutral-500">Acomodação</span>
            <p className="font-medium">{booking.roomName}</p>
          </div>
          <div>
            <span className="text-neutral-500">Entrada</span>
            <p className="font-medium">
              {fmtDate(booking.checkin)}
              {pousada.checkinTime ? ` · ${pousada.checkinTime}` : ''}
            </p>
          </div>
          <div>
            <span className="text-neutral-500">Saída</span>
            <p className="font-medium">
              {fmtDate(booking.checkout)}
              {pousada.checkoutTime ? ` · ${pousada.checkoutTime}` : ''}
            </p>
          </div>
          <div>
            <span className="text-neutral-500">Noites</span>
            <p className="font-medium">{booking.nights}</p>
          </div>
          <div className="col-span-3">
            <span className="text-neutral-500">Hóspedes</span>
            <p className="font-medium">
              {totalGuests} ({booking.adults} adultos, {booking.children} crianças, {booking.infants} bebês)
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-neutral-700 uppercase">Hóspede responsável</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Field label="Nome completo" value={responsible.fullName} span={3} />
            <Field label="Documento" value={fmtDoc(responsible.documentType, responsible.documentNumber)} />
            <Field label="Data de nascimento" value={fmtDate(responsible.birthDate)} />
            <Field label="Nacionalidade" value={responsible.nationality} />
            <Field label="Profissão" />
            <Field label="Telefone" value={responsible.phone} />
            <Field label="E-mail" value={responsible.email} />
            <Field label="Endereço" value={responsible.address} span={3} />
            <Field label="Cidade" value={responsible.city} />
            <Field label="UF" value={responsible.state} />
            <Field label="País" value={countryLabel(responsible.country)} />
            <Field label="CEP" value={responsible.cep} />
            <Field label="Procedência (de onde vem)" />
            <Field label="Próximo destino" />
            <Field label="Meio de transporte" />
            <Field label="Placa do veículo" />
          </div>
        </section>

        {companions.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-neutral-700 uppercase">Acompanhantes</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
                  <th className="py-1 pr-2 font-medium">Nome</th>
                  <th className="py-1 pr-2 font-medium">Tipo</th>
                  <th className="py-1 pr-2 font-medium">Documento</th>
                  <th className="py-1 font-medium">Nascimento</th>
                </tr>
              </thead>
              <tbody>
                {companions.map((c, i) => (
                  <tr key={i} className="border-b border-neutral-200">
                    <td className="py-1.5 pr-2">{c.fullName}</td>
                    <td className="py-1.5 pr-2">{GUEST_TYPE_LABEL[c.guestType]}</td>
                    <td className="py-1.5 pr-2">{fmtDoc(c.documentType, c.documentNumber) || '—'}</td>
                    <td className="py-1.5">{fmtDate(c.birthDate) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="pt-4 text-sm text-neutral-700">
          <p>Declaro serem verdadeiras as informações prestadas nesta ficha, exigida pela legislação de hospedagem em vigor.</p>
          <div className="mt-10 grid grid-cols-2 gap-8">
            <div className="border-t border-neutral-400 pt-1 text-center text-xs text-neutral-500">Assinatura do hóspede</div>
            <div className="border-t border-neutral-400 pt-1 text-center text-xs text-neutral-500">Data</div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({ label, value, span = 1 }: { label: string; value?: string | null; span?: 1 | 2 | 3 }) {
  return (
    <div className={span === 3 ? 'col-span-2 sm:col-span-3' : span === 2 ? 'col-span-2' : ''}>
      <span className="text-neutral-500">{label}</span>
      <p className="min-h-[1.25rem] border-b border-dotted border-neutral-300 font-medium">{value || ' '}</p>
    </div>
  )
}
