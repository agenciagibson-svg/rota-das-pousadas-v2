import type { BlogPhoto } from './types'

/**
 * Foto do Wikimedia Commons. `file` é o nome do arquivo com "_" no lugar dos
 * espaços; `hash` são as duas pastas do caminho (ex.: "c/c5"), que o Commons
 * calcula do nome. Usa a miniatura de 1920 px (larguras fixas do Commons).
 */
export function commons(p: {
  file: string
  hash: string
  alt: string
  credit: string
  license: string
}): BlogPhoto {
  // Mesmo formato das URLs do Commons: ' ( ) também vão codificados.
  const name = encodeURIComponent(p.file).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return {
    src: `https://upload.wikimedia.org/wikipedia/commons/thumb/${p.hash}/${name}/1920px-${name}`,
    alt: p.alt,
    credit: p.credit,
    license: p.license,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${name}`,
  }
}
