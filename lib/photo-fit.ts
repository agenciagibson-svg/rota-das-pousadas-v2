/** Quanto da altura aceitamos perder: cortar em cima e embaixo some com teto e chão. */
export const MAX_CROP_VERTICAL = 0.15
/** Quanto da largura aceitamos perder: as laterais costumam ser menos importantes. */
export const MAX_CROP_HORIZONTAL = 0.4

/**
 * Diz se a foto deve aparecer inteira (com fundo desfocado) em vez de
 * preencher o quadro. `photoRatio` e `boxRatio` são largura ÷ altura.
 */
export function shouldShowWholePhoto(photoRatio: number, boxRatio: number): boolean {
  if (!(photoRatio > 0) || !(boxRatio > 0)) return false
  if (photoRatio < boxRatio) return 1 - photoRatio / boxRatio > MAX_CROP_VERTICAL
  return 1 - boxRatio / photoRatio > MAX_CROP_HORIZONTAL
}
