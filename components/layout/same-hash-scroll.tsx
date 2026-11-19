'use client'

import { useEffect } from 'react'

/**
 * Clique em link de âncora cujo `#alvo` já está na barra de endereço.
 *
 * Sem isto, o segundo clique em "Destinos" não faz nada: o endereço não muda
 * (continua `/#destinos`), então nem o navegador nem o roteador rolam a
 * página. Quem rolou até o rodapé e clica de novo no menu fica parado.
 * Aqui a página rola até o alvo nesse caso; todos os outros cliques seguem
 * o caminho normal.
 */
export function sameHashTarget(
  href: string | null,
  current: { origin: string; pathname: string; search: string; hash: string },
): string | null {
  if (!href) return null
  let url: URL
  try {
    url = new URL(href, current.origin + current.pathname + current.search)
  } catch {
    return null
  }
  if (url.origin !== current.origin) return null
  if (url.pathname !== current.pathname || url.search !== current.search) return null
  if (url.hash.length < 2 || url.hash !== current.hash) return null
  try {
    return decodeURIComponent(url.hash.slice(1))
  } catch {
    return null
  }
}

export function SameHashScroll() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]')
      if (!anchor || anchor.getAttribute('target') === '_blank') return
      const id = sameHashTarget(anchor.getAttribute('href'), window.location)
      if (!id) return
      const target = document.getElementById(id)
      if (!target) return
      event.preventDefault()
      target.scrollIntoView({ block: 'start' })
    }
    // Fase de captura: roda antes do <Link> do Next, que cancela o clique e
    // pede ao roteador uma navegação para o mesmo endereço (que não rola).
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}
