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
