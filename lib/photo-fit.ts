/** Fração máxima da foto que aceitamos perder ao preencher um quadro. */
export const MAX_CROP = 0.15

/**
 * Diz se a foto deve aparecer inteira (com fundo desfocado) em vez de
 * preencher o quadro. `photoRatio` e `boxRatio` são largura ÷ altura.
 */
export function shouldShowWholePhoto(photoRatio: number, boxRatio: number): boolean {
  if (!(photoRatio > 0) || !(boxRatio > 0)) return false
  const kept = Math.min(photoRatio, boxRatio) / Math.max(photoRatio, boxRatio)
  return 1 - kept > MAX_CROP
}
