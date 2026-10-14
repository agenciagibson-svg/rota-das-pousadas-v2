import type { FormEvent } from 'react'

/**
 * Envia o formulário sem deixar o React limpar os campos.
 *
 * Com `<form action={fn}>` o React 19 reseta o formulário depois de TODO
 * envio — inclusive quando a validação falha. A pessoa via a mensagem de erro
 * com os campos vazios e tinha de digitar tudo de novo. Aqui o envio é um
 * `onSubmit` comum: os valores ficam; quem quiser limpar chama `form.reset()`
 * no sucesso.
 */
export function keepValuesOnSubmit(
  handler: (formData: FormData, form: HTMLFormElement) => unknown,
) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    void handler(new FormData(form), form)
  }
}

/** Mensagem para quando a action nem responde (queda de rede). */
export const SAVE_FAILED_MESSAGE = 'Não foi possível salvar. Confira a conexão e tente de novo.'
export const QUERY_FAILED_MESSAGE = 'Não foi possível consultar. Confira a conexão e tente de novo.'

/**
 * Mensagem geral de um formulário a partir da resposta de uma Server Action
 * (`ActionResult`). Com erro em campo que tem lugar na tela, orienta a olhar os
 * campos; erro sem campo visível (ou a chave `_`) continua aparecendo aqui.
 *
 * `isVisible`: lista dos campos que mostram o próprio erro, ou uma função.
 */
export function formErrorMessage(
  error: string,
  fieldErrors: Record<string, string>,
  isVisible: readonly string[] | ((key: string) => boolean),
): string {
  const visible =
    typeof isVisible === 'function' ? isVisible : (key: string) => isVisible.includes(key)
  const entries = Object.entries(fieldErrors)
  if (entries.length === 0) return error
  const orphans = entries.filter(([key]) => !visible(key)).map(([, message]) => message)
  const lead = orphans.length < entries.length ? 'Confira os campos destacados.' : error
  return [lead, ...new Set(orphans)].join(' ')
}
