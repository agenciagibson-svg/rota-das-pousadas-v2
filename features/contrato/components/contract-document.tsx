import { cn } from '@/lib/utils'
import { parseContractBody } from '../contract'

/**
 * O texto do contrato como foi montado (ou aceito). Só títulos e parágrafos:
 * nada é interpretado além disso, para a tela mostrar o que ficou guardado.
 */
export function ContractDocument({ body, className }: { body: string; className?: string }) {
  const blocks = parseContractBody(body)
  return (
    <article className={cn('text-foreground space-y-3 text-sm leading-relaxed', className)}>
      {blocks.map((block, index) =>
        block.kind === 'heading' ? (
          <h3 key={index} className="text-foreground pt-3 text-base font-semibold">
            {block.text}
          </h3>
        ) : (
          <p key={index}>{block.text}</p>
        ),
      )}
    </article>
  )
}
