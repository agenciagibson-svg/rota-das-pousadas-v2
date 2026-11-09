import { ExternalLink, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CADASTUR_SITE, cadasturStatus, cadasturFromColumns, todayIso } from '@/lib/cadastur'

/**
 * Cadastur em Configurações (0102): número e validade do certificado. Sem
 * número (ou vencido), mostra o passo a passo para a pousada se cadastrar —
 * o selo só aparece na página pública com o cadastro em dia.
 */
export function CadasturFields({
  number,
  validUntil,
  timeZone,
  errors,
}: {
  number: string
  validUntil: string
  timeZone?: string
  errors: { cadastur?: string; cadasturValidUntil?: string }
}) {
  const status = cadasturStatus(cadasturFromColumns(number, validUntil), todayIso(timeZone))

  return (
    <section id="cadastur" className="border-border bg-card scroll-mt-24 rounded-2xl border p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-foreground text-base font-semibold">Cadastur</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Cadastro do Ministério do Turismo, obrigatório para meios de hospedagem. Com o número em
            dia, a página da pousada mostra o selo “Cadastur” para o hóspede.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Número do Cadastur"
          name="cadastur"
          defaultValue={number}
          error={errors.cadastur}
          placeholder="Como está no certificado"
          inputMode="numeric"
        />
        <Input
          label="Validade do certificado (opcional)"
          name="cadasturValidUntil"
          type="date"
          defaultValue={validUntil}
          error={errors.cadasturValidUntil}
        />
      </div>

      {status === 'vencido' && (
        <p className="text-destructive mt-3 text-sm font-medium">
          O certificado venceu: o selo saiu da página. Renove no Cadastur e atualize a validade
          aqui.
        </p>
      )}

      {status === 'ausente' && (
        <div className="bg-muted/60 mt-4 rounded-xl p-4 text-sm">
          <p className="text-foreground font-semibold">Ainda não tem? É gratuito e online.</p>
          <ol className="text-muted-foreground mt-2 list-decimal space-y-1.5 pl-5">
            <li>Entre no site do Cadastur com a conta gov.br do responsável pela pousada.</li>
            <li>
              Escolha cadastrar um prestador de serviço turístico, na atividade “meio de
              hospedagem”, e preencha os dados da pousada.
            </li>
            <li>
              Envie os documentos pedidos. Depois da análise, baixe o certificado com o número.
            </li>
            <li>
              Volte aqui e informe o número e a validade. O certificado vale dois anos: depois da
              data, o selo sai da página até você atualizar.
            </li>
          </ol>
          <p className="text-muted-foreground mt-3">
            Sem o Cadastur a pousada também não usa a Ficha Nacional de Registro de Hóspedes
            digital, e a fiscalização do Ministério pode multar.
          </p>
          <a
            href={CADASTUR_SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary mt-3 inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
          >
            Abrir o site do Cadastur
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}
    </section>
  )
}
