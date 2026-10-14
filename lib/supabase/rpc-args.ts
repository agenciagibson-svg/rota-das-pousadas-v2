/**
 * Argumento de RPC que pode ir `null`.
 *
 * Os tipos gerados do banco (`database.types.ts`) declaram todo argumento de
 * função como não nulo, mas o Postgres aceita NULL e várias RPCs dependem
 * disso ("sem e-mail", "sem data"). Trocar `null` por `undefined` mudaria o
 * comportamento: o PostgREST deixa de enviar o argumento e o banco usa o
 * DEFAULT da função. Este helper mantém o `null` indo para o banco e concentra
 * num lugar só a diferença entre o tipo gerado e a realidade.
 */
export function orNull<T>(value: T | null | undefined): T {
  return (value ?? null) as T
}
