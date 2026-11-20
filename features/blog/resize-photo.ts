import { TIP_PHOTO_MAX_BYTES } from './schemas'

/**
 * Reduz a foto no navegador antes de enviar: lado maior até 1600 px, JPEG.
 * Redesenhar no canvas também descarta os metadados da câmera, inclusive a
 * localização (GPS) de onde a foto foi tirada.
 */
export async function resizePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    for (const [maxSide, quality] of [
      [1600, 0.82],
      [1280, 0.75],
      [1024, 0.7],
    ] as const) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality),
      )
      if (blob && blob.size <= TIP_PHOTO_MAX_BYTES) return blob
    }
  } finally {
    bitmap.close()
  }
  throw new Error('Não foi possível preparar a foto. Tente outra.')
}
